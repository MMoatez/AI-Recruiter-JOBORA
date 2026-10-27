import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common"
import { randomUUID } from "node:crypto"
import { DatabaseService } from "../database/database.service"
import { DEMO_JOBS } from "./demo-jobs"
import { JobMatcherAiClient, jobToSnapshot, toProfileUpdate } from "./job-matcher-ai.client"
import type {
  CandidateProfile,
  JobOffer,
  MatchProfileRecord,
  MatchResponsePayload,
  MatchSession,
  MatchSessionSummary,
} from "./job-matcher.types"
import type { CreateJobDto, CreateMatchDto, ProfileDto } from "./dto/job-matcher.dto"

const MAX_SESSION_JOBS = 50
const MAX_CV_TEXT = 20000

@Injectable()
export class JobMatcherService {
  private readonly logger = new Logger(JobMatcherService.name)

  constructor(
    private readonly database: DatabaseService,
    private readonly ai: JobMatcherAiClient,
  ) {}

  private jobs() { return this.database.collection("job_offers") }
  private profiles() { return this.database.collection("job_matcher_profiles") }
  private sessions() { return this.database.collection("job_matcher_sessions") }

  private async loadCv(userId: string, cvId: string) {
    // CVs live in the dedicated `cvs` table (see CvService), not in app_records.
    const row = this.database.connection
      .prepare("SELECT payload FROM cvs WHERE id = ? AND user_id = ?")
      .get(cvId, userId) as { payload: string } | undefined
    if (!row) throw new NotFoundException("CV introuvable.")
    return this.database.parse(row.payload)
  }

  private async loadOwnedJobs(userId: string): Promise<JobOffer[]> {
    const rows = await this.jobs().find({ userId }).lean().exec()
    return rows as unknown as JobOffer[]
  }

  private async storedProfile(userId: string, cvId: string): Promise<MatchProfileRecord | null> {
    const record = await this.profiles().findOne({ userId, cvId }).lean().exec()
    return (record as unknown as MatchProfileRecord | null) ?? null
  }

  private async persistProfile(userId: string, cvId: string, profile: CandidateProfile) {
    const now = this.database.now()
    const existing = await this.storedProfile(userId, cvId)
    const record: MatchProfileRecord = {
      id: existing?.id ?? `jprofile_${randomUUID()}`,
      userId,
      cvId,
      profile,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await this.profiles().create(record as unknown as Record<string, unknown>)
    return { cvId, profile, updatedAt: now }
  }

  async buildProfile(userId: string, cvId: string) {
    const cv = await this.loadCv(userId, cvId)
    const text = this.toCandidateText(cv as unknown as Record<string, unknown>)
    if (text.trim().length < 20) {
      throw new BadRequestException("Le CV ne contient pas assez de texte exploitable.")
    }
    const profile = await this.ai.parseCv(text)
    return this.persistProfile(userId, cvId, profile)
  }

  async getProfile(userId: string, cvId: string) {
    await this.loadCv(userId, cvId)
    const record = await this.storedProfile(userId, cvId)
    if (!record) throw new NotFoundException("Profil introuvable. Analyse ce CV d’abord.")
    return { cvId: record.cvId, profile: record.profile, updatedAt: record.updatedAt }
  }

  async saveProfile(userId: string, cvId: string, dto: ProfileDto) {
    await this.loadCv(userId, cvId)
    return this.persistProfile(userId, cvId, toProfileUpdate(dto))
  }

  async listJobs(userId: string) {
    const owned = await this.loadOwnedJobs(userId)
    return [...DEMO_JOBS, ...owned]
  }

  async createJob(userId: string, dto: CreateJobDto) {
    const now = this.database.now()
    const job: JobOffer = {
      id: `job_${randomUUID()}`,
      userId,
      title: dto.title.trim(),
      company: dto.company?.trim() ?? "",
      description: dto.description.trim(),
      requiredSkills: dto.requiredSkills ?? [],
      preferredSkills: dto.preferredSkills ?? [],
      minExperienceYears: dto.minExperienceYears ?? null,
      seniority: dto.seniority ?? "unknown",
      location: dto.location?.trim() ?? "",
      workArrangement: dto.workArrangement ?? "unknown",
      contractType: dto.contractType?.trim() ?? "",
      salaryRange: dto.salaryRange?.trim() ?? "",
      sourceUrl: dto.sourceUrl?.trim() ?? "",
      isDemo: false,
      createdAt: now,
      updatedAt: now,
    }
    await this.jobs().create(job as unknown as Record<string, unknown>)
    return job
  }

  async createMatch(userId: string, dto: CreateMatchDto): Promise<MatchSession> {
    await this.loadCv(userId, dto.cvId)

    const available = [...DEMO_JOBS, ...await this.loadOwnedJobs(userId)]
    const byId = new Map(available.map((job) => [job.id, job]))
    const requestedIds = dto.jobIds?.length ? Array.from(new Set(dto.jobIds)) : available.map((job) => job.id)
    if (requestedIds.length > MAX_SESSION_JOBS) {
      throw new BadRequestException(`Sélectionne au maximum ${MAX_SESSION_JOBS} offres.`)
    }
    const selected = requestedIds.map((id) => byId.get(id))
    if (selected.some((job) => job === undefined)) {
      throw new NotFoundException("Une offre sélectionnée est introuvable.")
    }

    let profile: CandidateProfile
    if (dto.profile) {
      profile = toProfileUpdate(dto.profile)
    } else {
      const stored = await this.storedProfile(userId, dto.cvId)
      if (!stored) throw new BadRequestException("Analyse ton CV avant de lancer le matching.")
      profile = stored.profile
    }

    const now = this.database.now()
    const session: MatchSession = {
      id: `match_${randomUUID()}`,
      userId,
      cvId: dto.cvId,
      status: "pending",
      profile,
      jobs: (selected as JobOffer[]).map(jobToSnapshot),
      topN: dto.topN ?? 10,
      createdAt: now,
      updatedAt: now,
    }
    await this.sessions().create(session as unknown as Record<string, unknown>)
    return session
  }

  /** Creates a session and starts its processing without blocking the HTTP response. */
  async startMatch(userId: string, dto: CreateMatchDto) {
    const session = await this.createMatch(userId, dto)
    void this.runMatching(session.id, userId).catch((error: unknown) => {
      this.logger.error(`Matching session kickoff failed: ${error instanceof Error ? error.name : "UnknownError"}`)
    })
    return {
      id: session.id,
      cvId: session.cvId,
      status: session.status,
      jobCount: session.jobs.length,
      createdAt: session.createdAt,
    }
  }

  private async findSession(userId: string, id: string): Promise<MatchSession | null> {
    const record = await this.sessions().findOne({ id, userId }).lean().exec()
    return (record as unknown as MatchSession | null) ?? null
  }

  private async requiredSession(userId: string, id: string): Promise<MatchSession> {
    const session = await this.findSession(userId, id)
    if (!session) throw new NotFoundException("Session de matching introuvable.")
    return session
  }

  async getStatus(userId: string, id: string) {
    const session = await this.requiredSession(userId, id)
    return {
      id: session.id,
      cvId: session.cvId,
      status: session.status,
      jobCount: session.jobs.length,
      error: session.error,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
    }
  }

  async getResults(userId: string, id: string) {
    const session = await this.requiredSession(userId, id)
    if (session.status === "failed") {
      throw new ConflictException(session.error || "Le matching a échoué. Relance une analyse.")
    }
    if (session.status !== "completed" || !session.results) {
      throw new ConflictException("Le matching est encore en cours.")
    }
    return {
      sessionId: session.id,
      cvId: session.cvId,
      status: session.status,
      createdAt: session.createdAt,
      completedAt: session.completedAt,
      ...session.results,
    }
  }

  async getHistory(userId: string): Promise<MatchSessionSummary[]> {
    const rows = await this.sessions().find({ userId }).sort({ createdAt: -1 }).lean().exec()
    return (rows as unknown as MatchSession[]).slice(0, 50).map((session) => ({
      id: session.id,
      cvId: session.cvId,
      status: session.status,
      jobCount: session.jobs?.length ?? 0,
      error: session.error,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      completedAt: session.completedAt,
      topScore: session.results?.results?.[0]?.compatibilityScore ?? null,
    }))
  }

  async deleteHistory(userId: string, id: string) {
    const result = await this.sessions().deleteOne({ id, userId }).exec()
    if (!result.deletedCount) throw new NotFoundException("Session de matching introuvable.")
    return { deleted: true }
  }

  /**
   * Runs a pending session once. Failures are persisted as `failed`; a session
   * is never marked completed without a validated provider response.
   */
  async runMatching(sessionId: string, userId: string): Promise<MatchSession | null> {
    const session = await this.findSession(userId, sessionId)
    if (!session) return null
    if (session.status !== "pending") return session

    const startedAt = this.database.now()
    await this.sessions().updateOne({ id: sessionId, userId }, { $set: { status: "processing", updatedAt: startedAt } })

    try {
      const payload: MatchResponsePayload = await this.ai.matchJobs(session.profile, session.jobs, session.topN)
      const completedAt = this.database.now()
      await this.sessions().updateOne(
        { id: sessionId, userId },
        { $set: { status: "completed", results: payload, error: undefined, completedAt, updatedAt: completedAt } },
      )
      return { ...session, status: "completed", results: payload, completedAt, updatedAt: completedAt }
    } catch (error) {
      const message = this.safeErrorMessage(error)
      this.logger.warn(`Matching session ${sessionId} failed: ${message}`)
      const updatedAt = this.database.now()
      await this.sessions().updateOne(
        { id: sessionId, userId },
        { $set: { status: "failed", error: message, updatedAt } },
      )
      return { ...session, status: "failed", error: message, updatedAt }
    }
  }

  private safeErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse()
      if (typeof response === "string") return response
      if (response && typeof response === "object" && "message" in response) {
        const message = (response as { message: unknown }).message
        if (typeof message === "string") return message
      }
    }
    return "Le matching a échoué. Réessaie dans un instant."
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
          if (Array.isArray(entry)) {
            return entry.filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
          }
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
    return sections.join("\n").slice(0, MAX_CV_TEXT)
  }
}
