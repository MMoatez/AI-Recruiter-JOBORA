import { BadGatewayException, BadRequestException, ConflictException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { randomUUID } from "node:crypto"
import { DatabaseService } from "../database/database.service"
import { extractCvText } from "../portfolio/portfolio-extraction"
import { AnalyzeMatchingDto } from "./dto/analyze-matching.dto"

type RoleMatch = { title: string; score: number }
type MatchingResult = {
  compatibility_score: number
  top_job_matches: RoleMatch[]
  algorithm: string
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name)
  private readonly aiUrl: string
  private readonly aiToken: string
  private readonly timeoutMs: number

  constructor(
    private readonly database: DatabaseService,
    config: ConfigService,
  ) {
    this.aiUrl = config.get<string>("TRAINING_AI_SERVICE_URL", "http://127.0.0.1:8002").replace(/\/$/, "")
    this.aiToken = config.get<string>("CV_MATCHING_INTERNAL_TOKEN")
      ?? config.get<string>("TRAINING_AI_INTERNAL_TOKEN", "")
    this.timeoutMs = Number(config.get("CV_MATCHING_TIMEOUT_MS", 120000))
  }

  async importPdf(userId: string, file: Express.Multer.File) {
    const { text } = await extractCvText(file.buffer)
    const now = this.database.now()
    const id = `cv_${randomUUID()}`
    const cv = {
      id, userId, title: file.originalname.replace(/\.pdf$/i, "").slice(0, 120) || "CV importé",
      targetJob: "", careerObjective: "", personalInformation: {}, professionalSummary: "",
      education: [], experiences: [], projects: [], technicalSkills: [], softSkills: [], tools: [],
      languages: [], certifications: [], rawText: text,
      atsValidation: null, ragMetadata: null, generatedContent: null, promptVersion: "PDF_IMPORT_001", status: "draft",
      createdAt: now, updatedAt: now,
    }
    try {
      this.database.connection.prepare("INSERT INTO cvs(id,user_id,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)")
        .run(id, userId, cv.title, JSON.stringify(cv), now, now)
    } catch (error) {
      this.logger.error("Could not persist imported CV.")
      throw new ConflictException("Le CV n’a pas pu être enregistré. Réessaie.")
    }
    return { cv, extractedTextLength: text.length }
  }

  async analyze(userId: string, dto: AnalyzeMatchingDto): Promise<MatchingResult> {
    const cv = await this.database.collection("cvs").findOne({ id: dto.cvId, userId }).lean().exec()
    if (!cv) throw new NotFoundException("CV introuvable.")
    if (!this.aiToken) throw new ServiceUnavailableException("Le service de matching n’est pas configuré.")

    let response: Response
    try {
      response = await fetch(`${this.aiUrl}/internal/matching/analyze`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-training-internal-token": this.aiToken,
        },
        body: JSON.stringify({
          resume_text: this.toCandidateText(cv as unknown as Record<string, unknown>),
          job_description: dto.jobDescription,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      this.logger.warn(`Matching AI request failed: ${error instanceof Error ? error.name : "UnknownError"}`)
      throw new ServiceUnavailableException("Le service de matching est temporairement indisponible.")
    }

    const payload = await response.json().catch(() => null) as Record<string, unknown> | null
    if (!response.ok) {
      this.logger.warn(`Matching AI service returned HTTP ${response.status}`)
      if (response.status === 422) {
        throw new BadRequestException("Le CV ou l’offre ne contient pas assez de texte exploitable.")
      }
      if (response.status === 503) {
        throw new ServiceUnavailableException("Le modèle de matching est temporairement indisponible.")
      }
      throw new BadGatewayException("Le service de matching a renvoyé une erreur.")
    }

    if (!payload || typeof payload.compatibility_score !== "number" || !Array.isArray(payload.top_job_matches)) {
      throw new BadGatewayException("Le service de matching a renvoyé une réponse invalide.")
    }
    return payload as unknown as MatchingResult
  }

  private toCandidateText(cv: Record<string, unknown>): string {
    const sections: string[] = []
    const addText = (label: string, value: unknown) => {
      if (typeof value === "string" && value.trim()) sections.push(`${label}: ${value.trim()}`)
    }
    const addList = (label: string, value: unknown) => {
      if (Array.isArray(value)) {
        const entries = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
        if (entries.length) sections.push(`${label}: ${entries.join(", ")}`)
      }
    }
    const addEntries = (label: string, value: unknown, fields: string[]) => {
      if (!Array.isArray(value)) return
      for (const item of value) {
        if (!item || typeof item !== "object") continue
        const record = item as Record<string, unknown>
        const text = fields.flatMap((field) => {
          const entry = record[field]
          if (typeof entry === "string" && entry.trim()) return [entry.trim()]
          if (Array.isArray(entry)) return entry.filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
          return []
        })
        if (text.length) sections.push(`${label}: ${text.join(" · ")}`)
      }
    }

    addText("Objectif", cv.careerObjective)
    addText("Poste cible", cv.targetJob)
    addText("Résumé", cv.professionalSummary)
    addText("Texte extrait du CV", cv.rawText)
    addEntries("Formation", cv.education, ["degree", "institution", "startDate", "endDate", "description"])
    addEntries("Expérience", cv.experiences, ["jobTitle", "company", "startDate", "endDate", "rawDescription", "bulletPoints"])
    addEntries("Projet", cv.projects, ["name", "description", "technologies"])
    addList("Compétences techniques", cv.technicalSkills)
    addList("Outils", cv.tools)
    addList("Compétences humaines", cv.softSkills)
    addEntries("Langue", cv.languages, ["language", "level"])
    addEntries("Certification", cv.certifications, ["name", "organization", "date"])
    return sections.join("\n").slice(0, 20000)
  }
}
