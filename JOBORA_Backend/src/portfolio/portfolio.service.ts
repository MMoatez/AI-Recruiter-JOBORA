import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { DatabaseService } from "../database/database.service"
import type { SqliteCollection } from "../database/sqlite-collection"
import { OllamaService } from "../ollama/ollama.service"
import { PortfolioDataDto } from "./portfolio.dto"
import { emptyPortfolioData, PortfolioData } from "./portfolio-data"
import { PORTFOLIO_GENERATION_PROMPTS } from "./portfolio.prompts"
import type { PortfolioDocument } from "./portfolio.schema"
import { PortfolioProject } from "./portfolio-data"
import { extractCvText, extractFromCv } from "./portfolio-extraction"

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name)

  constructor(
    private readonly database: DatabaseService,
    private readonly ollama: OllamaService,
  ) {
    this.portfolios = database.collection<PortfolioDocument>("portfolios")
  }

  private readonly portfolios: SqliteCollection<PortfolioDocument>

  async generate(userId: string, file: Express.Multer.File): Promise<PortfolioDocument> {
    const { text } = await this.extractCvText(file.buffer)
    const { cleaned, removedItems } = await this.extractFromCv(text)
    const data = await this.enhanceProjects(cleaned as PortfolioData)
    data.headline = await this.generateHeadline(data)
    data.about = await this.generateAbout(data)

    const serializedRemovedItems = removedItems.map(({ field, value }) => `${field}: ${value}`)
    const sourceCvId = this.storeSourceCv(userId, file)
    const initial: PortfolioDocument = {
      id: userId,
      userId,
      data: emptyPortfolioData(),
      templateId: "developer",
      slug: null,
      publishedAt: null,
      lastSyncedAt: null,
      sourceCvName: "",
      sourceCvText: "",
      sourceCvFileId: null,
      removedItems: [],
      status: "draft",
      createdAt: this.database.now(),
      updatedAt: this.database.now(),
    }
    const portfolio = await this.portfolios.findOneAndUpdate(
      { userId },
      {
        $set: {
          data,
          sourceCvName: file.originalname,
          sourceCvText: text,
          sourceCvFileId: sourceCvId,
          removedItems: serializedRemovedItems,
          lastSyncedAt: new Date(),
        },
        $setOnInsert: { userId },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, defaults: initial },
    ).exec()
    if (!portfolio) throw new NotFoundException("Portfolio introuvable après l’enregistrement du CV.")
    return portfolio as PortfolioDocument
  }

  async getMineCv(userId: string): Promise<{ buffer: Buffer; filename: string }> {
    const stored = this.database.connection.prepare("SELECT filename, content FROM portfolio_files WHERE user_id = ?").get(userId) as { filename: string; content: Buffer } | undefined
    if (!stored) throw new NotFoundException("Aucun CV source n’est enregistré pour ce portfolio.")
    return {
      buffer: Buffer.from(stored.content),
      filename: stored.filename || "cv.pdf",
    }
  }

  async getPublishedCv(slug: string): Promise<{ buffer: Buffer; filename: string }> {
    const portfolio = await this.portfolios.findOne({ slug, status: "published" }).lean().exec()
    const stored = portfolio && (portfolio.data as PortfolioData)?.showCvDownload === true
      ? this.database.connection.prepare("SELECT filename, content FROM portfolio_files WHERE user_id = ?").get(portfolio.userId) as { filename: string; content: Buffer } | undefined
      : undefined
    if (!portfolio || !stored) throw new NotFoundException("Téléchargement du CV indisponible.")
    return {
      buffer: Buffer.from(stored.content),
      filename: stored.filename || "cv.pdf",
    }
  }

  async sync(userId: string): Promise<PortfolioDocument> {
    const current = await this.portfolios.findOne({ userId }).select("+sourceCvText").exec()
    if (!current) throw new NotFoundException("Portfolio introuvable.")
    if (!current.sourceCvText?.trim()) {
      throw new BadRequestException(
        "Aucun texte de CV source n’est enregistré pour ce portfolio. Importez de nouveau le CV avant de synchroniser.",
      )
    }

    const { cleaned, removedItems } = await this.extractFromCv(current.sourceCvText)
    const serializedRemovedItems = removedItems.map(({ field, value }) => `${field}: ${value}`)
    const updated = await this.portfolios.findOneAndUpdate(
      { userId },
      {
        $set: {
          "data.education": cleaned.education,
          "data.experiences": cleaned.experiences,
          "data.projects": cleaned.projects,
          "data.skills": cleaned.skills,
          "data.certifications": cleaned.certifications,
          removedItems: serializedRemovedItems,
          lastSyncedAt: new Date(),
        },
      },
      { new: true, runValidators: true },
    ).exec()
    if (!updated) throw new NotFoundException("Portfolio introuvable.")
    return updated as PortfolioDocument
  }

  async getMine(userId: string): Promise<PortfolioDocument> {
    const portfolio = await this.portfolios.findOne({ userId }).exec()
    if (!portfolio) throw new NotFoundException("Portfolio introuvable.")
    return portfolio as PortfolioDocument
  }

  async publish(userId: string): Promise<PortfolioDocument> {
    const current = await this.portfolios.findOne({ userId }).exec()
    if (!current) throw new NotFoundException("Portfolio introuvable.")

    const baseSlug = this.toSlug(current.data.fullName) || "portfolio"
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = current.slug ?? (attempt === 0 ? baseSlug : `${baseSlug}-${randomUUID().slice(0, 6)}`)
      try {
        const published = await this.portfolios.findOneAndUpdate(
          { userId },
          { $set: { slug, status: "published", publishedAt: new Date() } },
          { new: true, runValidators: true },
        ).exec()
        if (!published) throw new NotFoundException("Portfolio introuvable.")
        return published as PortfolioDocument
      } catch (error) {
        if (!this.isUniqueConstraintError(error)) throw error
      }
    }

    throw new ConflictException("Impossible de générer un slug unique pour ce portfolio.")
  }

  async unpublish(userId: string): Promise<PortfolioDocument> {
    const portfolio = await this.portfolios.findOneAndUpdate(
      { userId },
      { $set: { status: "draft", publishedAt: null } },
      { new: true, runValidators: true },
    ).exec()
    if (!portfolio) throw new NotFoundException("Portfolio introuvable.")
    return portfolio as PortfolioDocument
  }

  async getPublished(slug: string) {
    const portfolio = await this.portfolios.findOne({ slug, status: "published" })
      .select({
        _id: 0,
        data: 1,
        templateId: 1,
        slug: 1,
        status: 1,
        publishedAt: 1,
      })
      .lean()
      .exec()
    if (!portfolio) throw new NotFoundException("Portfolio public introuvable.")

    const data = portfolio.data as unknown as PortfolioData
    const publicData = {
      fullName: data.fullName,
      title: data.title,
      headline: data.headline,
      availableForWork: data.availableForWork,
      showCvDownload: data.showCvDownload,
      ...(data.contactVisibility?.email === true ? { email: data.email } : {}),
      ...(data.contactVisibility?.phone === true ? { phone: data.phone } : {}),
      location: data.location,
      links: data.links,
      sections: data.sections,
      theme: data.theme,
      about: data.about,
      education: data.education,
      experiences: data.experiences,
      projects: data.projects,
      skills: data.skills,
      languages: data.languages,
      certifications: data.certifications,
    }

    return {
      slug: portfolio.slug,
      templateId: portfolio.templateId,
      status: "published" as const,
      publishedAt: portfolio.publishedAt,
      data: publicData,
    }
  }

  async updateMine(userId: string, data: PortfolioDataDto): Promise<PortfolioDocument> {
    const saved = await this.portfolios.findOneAndUpdate(
      { userId },
      { $set: { data }, $setOnInsert: { userId } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec()
    if (!saved) throw new NotFoundException("Portfolio introuvable.")
    return saved
  }

  async updateTemplate(userId: string, templateId: string): Promise<PortfolioDocument> {
    const saved = await this.portfolios.findOneAndUpdate(
      { userId },
      { $set: { templateId }, $setOnInsert: { userId } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).exec()
    if (!saved) throw new NotFoundException("Portfolio introuvable.")
    return saved
  }

  async regenerateAbout(userId: string): Promise<PortfolioDocument> {
    const current = await this.getMine(userId)
    const about = await this.generateAbout(current.data as unknown as PortfolioData)
    const updated = await this.portfolios.findOneAndUpdate(
      { userId },
      { $set: { "data.about": about } },
      { new: true, runValidators: true },
    ).exec()
    if (!updated) throw new NotFoundException("Portfolio introuvable.")
    return updated as PortfolioDocument
  }

  async rankProjects(
    projects: PortfolioProject[],
    jobText: string,
  ): Promise<{ project: PortfolioProject; score: number }[]> {
    if (!projects.length) return []

    const texts = [
      ...projects.map((project) =>
        [project.name, project.description, ...project.technologies].filter(Boolean).join("\n"),
      ),
      jobText,
    ]
    const embeddings = await this.ollama.embed(texts)
    const jobEmbedding = embeddings[embeddings.length - 1]
    if (!jobEmbedding) throw new BadGatewayException("Ollama n’a pas retourné l’embedding de l’offre.")

    return projects
      .map((project, index) => {
        const embedding = embeddings[index]
        if (!embedding || embedding.length !== jobEmbedding.length) {
          throw new BadGatewayException("Ollama a retourné des embeddings incompatibles pour le classement des projets.")
        }
        return { project, score: this.cosineSimilarity(embedding, jobEmbedding) }
      })
      .sort((left, right) => right.score - left.score)
  }

  async rankMineProjects(userId: string, jobText: string) {
    const current = await this.getMine(userId)
    const ranked = await this.rankProjects(current.data.projects as unknown as PortfolioProject[], jobText)
    const updated = await this.portfolios.findOneAndUpdate(
      { userId },
      { $set: { "data.projects": ranked.map(({ project }) => project) } },
      { new: true, runValidators: true },
    ).exec()
    if (!updated) throw new NotFoundException("Portfolio introuvable.")
    return {
      portfolio: updated as PortfolioDocument,
      scores: ranked.map(({ project, score }) => ({ projectName: project.name, score })),
    }
  }

  async deleteMine(userId: string): Promise<{ deleted: true }> {
    const portfolio = await this.portfolios.findOne({ userId }).exec()
    if (!portfolio) throw new NotFoundException("Portfolio introuvable.")
    const result = await this.portfolios.deleteOne({ userId }).exec()
    if (!result.deletedCount) throw new NotFoundException("Portfolio introuvable.")
    this.database.connection.prepare("DELETE FROM portfolio_files WHERE user_id = ?").run(userId)
    return { deleted: true }
  }

  async extractCvText(buffer: Buffer): Promise<{ text: string; length: number }> {
    return extractCvText(buffer)
  }

  async extractFromCv(cvText: string): Promise<{ cleaned: PortfolioDataDto; removedItems: { field: string; value: string }[] }> {
    return extractFromCv(this.ollama, cvText)
  }

  async generateAbout(data: PortfolioData): Promise<string> {
    const userPrompt = JSON.stringify({
      education: data.education,
      skills: data.skills,
      projects: data.projects,
    })
    const startedAt = Date.now()
    const result = await this.ollama.generateJson(PORTFOLIO_GENERATION_PROMPTS.about, userPrompt, 0.3)
    this.logger.log(`Génération de la présentation portfolio terminée en ${Date.now() - startedAt} ms.`)

    if (!this.isRecord(result) || typeof result.about !== "string" || !result.about.trim()) {
      throw new BadGatewayException("Ollama a retourné une présentation portfolio invalide.")
    }
    return result.about.trim()
  }

  async generateHeadline(data: PortfolioData): Promise<string> {
    const userPrompt = JSON.stringify({ title: data.title, skills: data.skills })
    const startedAt = Date.now()
    const result = await this.ollama.generateJson(PORTFOLIO_GENERATION_PROMPTS.headline, userPrompt, 0.3)
    this.logger.log(`Génération de l’accroche portfolio terminée en ${Date.now() - startedAt} ms.`)

    if (!this.isRecord(result) || typeof result.headline !== "string") {
      throw new BadGatewayException("Ollama a retourné une accroche portfolio invalide.")
    }
    const headline = result.headline.trim()
    const wordCount = headline ? headline.split(/\s+/u).length : 0
    if (wordCount < 8 || wordCount > 12) {
      throw new BadGatewayException("L’accroche portfolio doit contenir entre 8 et 12 mots.")
    }
    return headline
  }

  async enhanceProjects(data: PortfolioData): Promise<PortfolioData> {
    const projects = []
    for (const project of data.projects) {
      const userPrompt = JSON.stringify({
        name: project.name,
        year: project.year,
        description: project.description,
        technologies: project.technologies,
      })
      const startedAt = Date.now()
      const result = await this.ollama.generateJson(PORTFOLIO_GENERATION_PROMPTS.project, userPrompt)
      this.logger.log(`Amélioration du projet "${project.name}" terminée en ${Date.now() - startedAt} ms.`)

      if (!this.isRecord(result)) {
        throw new BadGatewayException(`Ollama a retourné une réponse invalide pour le projet "${project.name}".`)
      }

      const technologiesUnchanged =
        Array.isArray(result.technologies) &&
        result.technologies.every((technology): technology is string => typeof technology === "string") &&
        result.technologies.length === project.technologies.length &&
        result.technologies.every((technology, index) => technology === project.technologies[index])
      const description = typeof result.description === "string" && result.description.trim()
        ? result.description.trim()
        : project.description

      projects.push({
        ...project,
        description: technologiesUnchanged ? description : project.description,
      })
    }
    return { ...data, projects }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
  }

  private toSlug(value: string): string {
    return value
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  }

  private storeSourceCv(userId: string, file: Express.Multer.File): string {
    const id = randomUUID()
    this.database.connection.prepare(`INSERT INTO portfolio_files(id,user_id,filename,content) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,filename=excluded.filename,content=excluded.content`)
      .run(id, userId, file.originalname, file.buffer)
    return id
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Error && error.message.includes("UNIQUE constraint failed")
  }

  private cosineSimilarity(left: number[], right: number[]): number {
    if (left.length !== right.length) {
      throw new BadGatewayException("Ollama a retourné des embeddings de dimensions incompatibles.")
    }
    let dot = 0
    let leftNorm = 0
    let rightNorm = 0
    for (let index = 0; index < left.length; index += 1) {
      dot += left[index] * right[index]
      leftNorm += left[index] * left[index]
      rightNorm += right[index] * right[index]
    }
    const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
    if (!denominator) throw new BadGatewayException("Ollama a retourné un embedding de norme nulle.")
    return dot / denominator
  }

}
