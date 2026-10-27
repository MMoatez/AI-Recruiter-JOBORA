import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import { AtsValidationService } from "./ats-validation.service"
import { CreateCvDto, RegenerateSectionDto, UpdateCvDto } from "./dto/cv.dto"
import { GeminiService } from "./gemini.service"

@Injectable()
export class CvService {
  constructor(
    private readonly database: DatabaseService,
    private readonly gemini: GeminiService,
    private readonly ats: AtsValidationService,
  ) {}

  list(userId: string) {
    return (this.database.connection.prepare("SELECT payload FROM cvs WHERE user_id = ? ORDER BY updated_at DESC").all(userId) as Array<{ payload: string }>)
      .map((row) => this.database.parse((row as { payload: string }).payload))
  }

  async get(userId: string, id: string) {
    const row = this.database.connection.prepare("SELECT payload FROM cvs WHERE id = ? AND user_id = ?").get(id, userId) as { payload: string } | undefined
    const cv = row ? this.database.parse(row.payload) : null
    if (!cv) throw new NotFoundException("CV introuvable.")
    return cv
  }

  async create(userId: string, dto: CreateCvDto) {
    const now = this.database.now()
    const cv = { ...dto, userId, createdAt: now, updatedAt: now }
    try { this.database.connection.prepare("INSERT INTO cvs (id, user_id, title, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(dto.id, userId, dto.title, JSON.stringify(cv), now, now) }
    catch (error) { if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) throw new ConflictException("Ce CV existe déjà."); throw error }
    return cv
  }

  async update(userId: string, id: string, dto: UpdateCvDto) {
    const current = await this.get(userId, id)
    const next = { ...current, ...dto, id, userId, updatedAt: this.database.now() }
    this.database.connection.prepare("UPDATE cvs SET title = ?, payload = ?, updated_at = ? WHERE id = ? AND user_id = ?")
      .run(next.title, JSON.stringify(next), next.updatedAt, id, userId)
    return next
  }

  async remove(userId: string, id: string) {
    const result = this.database.connection.prepare("DELETE FROM cvs WHERE id = ? AND user_id = ?").run(id, userId)
    if (!result.changes) throw new NotFoundException("CV introuvable.")
    return { deleted: true }
  }

  async generate(userId: string, id: string) {
    const current = await this.get(userId, id)
    const candidate = this.toSafeCandidate(current as unknown as Record<string, unknown>)
    const result = await this.gemini.generate(candidate)
    const generated = this.mergeGeneratedContent(candidate, result.content)
    const deterministic = this.ats.validate(generated as unknown as Parameters<AtsValidationService["validate"]>[0])
    const aiValidation = await this.gemini.validateAts(generated, result.ragContext)
    const next = {
      ...generated,
      generatedContent: result.content,
      atsValidation: this.ats.merge(deterministic, aiValidation),
      ragMetadata: result.ragMetadata,
      status: "generated",
      promptVersion: "CV_GENERATE_001_V7",
    }
    return this.update(userId, id, next as never)
  }

  async validate(userId: string, id: string) {
    const cv = await this.get(userId, id) as unknown as Record<string, unknown>
    const safeCv = this.toSafeCandidate(cv)
    const deterministic = this.ats.validate(safeCv as unknown as Parameters<AtsValidationService["validate"]>[0])
    return this.ats.merge(deterministic, await this.gemini.validateAts(safeCv))
  }

  async regenerateSection(userId: string, id: string, dto: RegenerateSectionDto) {
    const current = await this.get(userId, id) as unknown as Record<string, unknown>
    const targetJob = String(current.targetJob ?? "")
    const index = dto.index ?? 0
    const experiences = [...((current.experiences as Array<Record<string, unknown>>) ?? [])]
    const projects = [...((current.projects as Array<Record<string, unknown>>) ?? [])]
    let source: unknown
    if (dto.section === "summary") source = { professionalSummary: current.professionalSummary, careerObjective: current.careerObjective, technicalSkills: current.technicalSkills }
    else if (dto.section === "experience") source = experiences[index]
    else source = projects[index]
    if (!source) throw new NotFoundException("Section du CV introuvable.")
    const regenerated = await this.gemini.regenerateSection(dto.section, source, targetJob)
    const content = regenerated.content
    const patch: Record<string, unknown> = {}
    if (dto.section === "summary") {
      patch.professionalSummary = content
    } else if (dto.section === "experience") {
      experiences[index] = { ...experiences[index], bulletPoints: content }
      patch.experiences = experiences
    } else {
      projects[index] = { ...projects[index], description: content }
      patch.projects = projects

    }

    const candidate = { ...this.toSafeCandidate(current), ...patch }
    patch.atsValidation = this.ats.validate(candidate as unknown as Parameters<AtsValidationService["validate"]>[0])
    patch.ragMetadata = regenerated.ragMetadata
    patch.promptVersion = "CV_GENERATE_001_V7"
    return this.update(userId, id, patch as never)
  }

  private toSafeCandidate(cv: Record<string, unknown>) {
    const { _id, __v, userId, personalInformation, atsValidation, ragMetadata, generatedContent, createdAt, updatedAt, ...candidate } = cv
    void _id; void __v; void userId; void personalInformation; void atsValidation; void ragMetadata; void generatedContent; void createdAt; void updatedAt
    return candidate
  }

  private mergeGeneratedContent(candidate: Record<string, unknown>, generated: Record<string, unknown>) {
    const originals = <T extends Record<string, unknown>>(key: string) => Array.isArray(candidate[key]) ? candidate[key] as T[] : []
    const outputs = <T extends Record<string, unknown>>(key: string) => Array.isArray(generated[key]) ? generated[key] as T[] : []
    const findOutput = (item: Record<string, unknown>, values: Record<string, unknown>[], identityKeys: string[]) => {
      const id = String(item.id ?? "").trim()
      if (id) return values.find((value) => String(value.id ?? "").trim() === id)
      const identity = (value: Record<string, unknown>) => identityKeys.map((key) => String(value[key] ?? "").trim().toLocaleLowerCase()).join("\u0000")
      const sourceIdentity = identity(item)
      if (!sourceIdentity.replace(/\u0000/g, "")) return undefined
      const matches = values.filter((value) => identity(value) === sourceIdentity)
      return matches.length === 1 ? matches[0] : undefined
    }
    const educationOutputs = outputs("education")
    const experienceOutputs = outputs("experiences")
    const projectOutputs = outputs("projects")
    const education = originals("education").map((item) => {
      const output = findOutput(item, educationOutputs, ["degree", "institution", "startDate", "endDate"])
      return { ...item, description: String(output?.description ?? item.description ?? "") }
    })
    const experiences = originals("experiences").map((item) => {
      const output = findOutput(item, experienceOutputs, ["jobTitle", "company", "startDate", "endDate"])
      return { ...item, bulletPoints: Array.isArray(output?.bulletPoints) ? output.bulletPoints : item.bulletPoints ?? [] }
    })
    const projects = originals("projects").map((item) => {
      const output = findOutput(item, projectOutputs, ["name"])
      return { ...item, description: String(output?.description ?? item.description ?? "") }
    })
    const allowedSkills = (Array.isArray(candidate.technicalSkills) ? candidate.technicalSkills : []).map(String)
    const proposedSkills = (Array.isArray(generated.technicalSkills) ? generated.technicalSkills : []).map(String)
    const technicalSkills = proposedSkills.filter((skill) => allowedSkills.some((allowed) => allowed.toLocaleLowerCase() === skill.toLocaleLowerCase()))
    return {
      professionalSummary: String(generated.professionalSummary ?? ""), education, experiences, projects,
      technicalSkills: technicalSkills.length ? technicalSkills : allowedSkills,
      softSkills: Array.isArray(candidate.softSkills) ? candidate.softSkills : [],
      languages: Array.isArray(candidate.languages) ? candidate.languages : [],
      certifications: Array.isArray(candidate.certifications) ? candidate.certifications : [],
    }
  }
}
