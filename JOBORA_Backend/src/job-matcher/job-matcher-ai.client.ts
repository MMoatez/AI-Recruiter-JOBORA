import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import type {
  CandidateProfile,
  ExcludedJob,
  JobMatchResult,
  JobOffer,
  MatchJobSnapshot,
  MatchResponsePayload,
  ScoreBreakdown,
  Seniority,
  WorkArrangement,
} from "./job-matcher.types"

type Json = Record<string, unknown>

const SENIORITY: Seniority[] = ["junior", "mid", "senior", "unknown"]
const ARRANGEMENTS: WorkArrangement[] = ["remote", "hybrid", "onsite", "unknown"]
const INVALID_PAYLOAD = "Le service de matching a renvoyé une réponse invalide."

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function seniority(value: unknown): Seniority {
  return typeof value === "string" && SENIORITY.includes(value as Seniority) ? (value as Seniority) : "unknown"
}

function arrangement(value: unknown): WorkArrangement {
  return typeof value === "string" && ARRANGEMENTS.includes(value as WorkArrangement)
    ? (value as WorkArrangement)
    : "unknown"
}

export function mapProfile(raw: unknown): CandidateProfile {
  if (!isRecord(raw)) throw new BadGatewayException(INVALID_PAYLOAD)
  return {
    skills: stringArray(raw.skills),
    experienceYears: nullableNumber(raw.experience_years),
    seniority: seniority(raw.seniority),
    jobTitles: stringArray(raw.job_titles),
    languages: stringArray(raw.languages),
    education: stringArray(raw.education),
    certifications: stringArray(raw.certifications),
    preferredLocations: stringArray(raw.preferred_locations),
    workPreferences: stringArray(raw.work_preferences),
  }
}

export function profileToAi(profile: CandidateProfile): Json {
  return {
    skills: profile.skills,
    experience_years: profile.experienceYears,
    seniority: profile.seniority,
    job_titles: profile.jobTitles,
    languages: profile.languages,
    education: profile.education,
    certifications: profile.certifications,
    preferred_locations: profile.preferredLocations,
    work_preferences: profile.workPreferences,
  }
}

function snapshotToAi(job: MatchJobSnapshot): Json {
  return {
    job_id: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    required_skills: job.requiredSkills,
    preferred_skills: job.preferredSkills,
    seniority: job.seniority,
    min_experience_years: job.minExperienceYears,
    education_requirement: job.educationRequirement,
    location: job.location,
    work_arrangement: job.workArrangement,
    contract_type: job.contractType,
  }
}

function mapBreakdown(value: unknown): ScoreBreakdown {
  if (!isRecord(value)) throw new BadGatewayException(INVALID_PAYLOAD)
  const total = value.applicable_weight_total
  if (typeof total !== "number" || !Number.isFinite(total)) throw new BadGatewayException(INVALID_PAYLOAD)
  return {
    requiredSkills: nullableNumber(value.required_skills),
    preferredSkills: nullableNumber(value.preferred_skills),
    experience: nullableNumber(value.experience),
    seniority: nullableNumber(value.seniority),
    semanticFit: nullableNumber(value.semantic_fit),
    applicableWeightTotal: total,
  }
}

function mapResult(value: unknown): JobMatchResult {
  if (!isRecord(value)) throw new BadGatewayException(INVALID_PAYLOAD)
  if (typeof value.job_id !== "string" || !value.job_id) throw new BadGatewayException(INVALID_PAYLOAD)
  if (typeof value.job_title !== "string" || !value.job_title) throw new BadGatewayException(INVALID_PAYLOAD)
  const score = value.compatibility_score
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 100) {
    throw new BadGatewayException(INVALID_PAYLOAD)
  }
  return {
    jobId: value.job_id,
    jobTitle: value.job_title,
    company: typeof value.company === "string" ? value.company : "",
    location: typeof value.location === "string" ? value.location : "",
    workArrangement: arrangement(value.work_arrangement),
    compatibilityScore: score,
    matchedSkills: stringArray(value.matched_skills),
    missingRequiredSkills: stringArray(value.missing_required_skills),
    missingPreferredSkills: stringArray(value.missing_preferred_skills),
    semanticFit: nullableNumber(value.semantic_fit),
    reasons: stringArray(value.reasons),
    recommendations: stringArray(value.recommendations),
    gaps: stringArray(value.gaps),
    scoreBreakdown: mapBreakdown(value.score_breakdown),
  }
}

function mapExcluded(value: unknown): ExcludedJob[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.job_id !== "string") return []
    return [{ jobId: entry.job_id, reason: typeof entry.reason === "string" ? entry.reason : "ineligible" }]
  })
}

function mapWeights(value: unknown): Record<string, number> {
  if (!isRecord(value)) throw new BadGatewayException(INVALID_PAYLOAD)
  const weights: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) weights[key] = raw
  }
  if (!Object.keys(weights).length) throw new BadGatewayException(INVALID_PAYLOAD)
  return weights
}

export function mapMatchResponse(raw: unknown): MatchResponsePayload {
  if (!isRecord(raw) || !Array.isArray(raw.results)) throw new BadGatewayException(INVALID_PAYLOAD)
  if (typeof raw.total_jobs_analyzed !== "number" || typeof raw.total_jobs_eligible !== "number") {
    throw new BadGatewayException(INVALID_PAYLOAD)
  }
  return {
    results: raw.results.map(mapResult),
    totalJobsAnalyzed: raw.total_jobs_analyzed,
    totalJobsEligible: raw.total_jobs_eligible,
    excludedJobs: mapExcluded(raw.excluded_jobs),
    weights: mapWeights(raw.weights),
    algorithm: typeof raw.algorithm === "string" ? raw.algorithm : "hybrid",
  }
}

export function toProfileUpdate(dto: {
  skills?: string[]
  experienceYears?: number | null
  seniority?: Seniority
  jobTitles?: string[]
  languages?: string[]
  education?: string[]
  certifications?: string[]
  preferredLocations?: string[]
  workPreferences?: string[]
}): CandidateProfile {
  return {
    skills: dto.skills ?? [],
    experienceYears: dto.experienceYears ?? null,
    seniority: dto.seniority ?? "unknown",
    jobTitles: dto.jobTitles ?? [],
    languages: dto.languages ?? [],
    education: dto.education ?? [],
    certifications: dto.certifications ?? [],
    preferredLocations: dto.preferredLocations ?? [],
    workPreferences: dto.workPreferences ?? [],
  }
}

export function jobToSnapshot(job: JobOffer): MatchJobSnapshot {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    requiredSkills: job.requiredSkills,
    preferredSkills: job.preferredSkills,
    minExperienceYears: job.minExperienceYears,
    seniority: job.seniority,
    location: job.location,
    workArrangement: job.workArrangement,
    contractType: job.contractType,
    educationRequirement: "",
    isDemo: job.isDemo,
  }
}

@Injectable()
export class JobMatcherAiClient {
  private readonly logger = new Logger(JobMatcherAiClient.name)
  private readonly baseUrl: string
  private readonly token: string
  private readonly timeoutMs: number

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>("JOB_MATCHER_AI_SERVICE_URL", "http://127.0.0.1:8010").replace(/\/$/, "")
    this.token = config.get<string>("JOB_MATCHER_INTERNAL_TOKEN")
      ?? config.get<string>("TRAINING_AI_INTERNAL_TOKEN", "")
      ?? ""
    const configured = Number(config.get("JOB_MATCHER_AI_TIMEOUT_MS", 120000))
    this.timeoutMs = Number.isFinite(configured) && configured > 0 ? configured : 120000
  }

  get isConfigured(): boolean {
    return Boolean(this.token)
  }

  async parseCv(cvText: string): Promise<CandidateProfile> {
    const payload = await this.post("/parse-cv", { cv_text: cvText })
    if (!isRecord(payload)) throw new BadGatewayException(INVALID_PAYLOAD)
    return mapProfile(payload.profile)
  }

  async matchJobs(profile: CandidateProfile, jobs: MatchJobSnapshot[], topN: number): Promise<MatchResponsePayload> {
    const payload = await this.post("/match-jobs", {
      profile: profileToAi(profile),
      jobs: jobs.map(snapshotToAi),
      options: { top_n: topN },
    })
    return mapMatchResponse(payload)
  }

  private async post(path: string, body: Json): Promise<unknown> {
    if (!this.token) {
      throw new ServiceUnavailableException("Le service de matching n’est pas configuré.")
    }
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-job-matcher-internal-token": this.token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      })
    } catch (error) {
      const name = error instanceof Error ? error.name : "UnknownError"
      this.logger.warn(`Job matcher AI request failed (${path}): ${name}`)
      if (name === "TimeoutError" || name === "AbortError") {
        throw new GatewayTimeoutException("Le service de matching n’a pas répondu à temps.")
      }
      throw new ServiceUnavailableException("Le service de matching est temporairement indisponible.")
    }

    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      this.logger.warn(`Job matcher AI service returned HTTP ${response.status} on ${path}`)
      if (response.status === 400) {
        const detail = isRecord(payload) && typeof payload.detail === "string" ? payload.detail : null
        throw new BadRequestException(detail || "Le contenu envoyé au service de matching est invalide.")
      }
      if (response.status === 403) {
        throw new ServiceUnavailableException("Le service de matching refuse la configuration interne.")
      }
      if (response.status === 429 || response.status === 502 || response.status === 503) {
        throw new ServiceUnavailableException("Le service de matching est temporairement indisponible.")
      }
      if (response.status === 504) {
        throw new GatewayTimeoutException("Le service de matching n’a pas répondu à temps.")
      }
      throw new BadGatewayException(INVALID_PAYLOAD)
    }
    return payload
  }
}
