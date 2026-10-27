export type Seniority = "junior" | "mid" | "senior" | "unknown"
export type WorkArrangement = "remote" | "hybrid" | "onsite" | "unknown"
export type MatchSessionStatus = "pending" | "processing" | "completed" | "failed"

/** Structured, evidence-based view of the candidate (camelCase API contract). */
export type CandidateProfile = {
  skills: string[]
  experienceYears: number | null
  seniority: Seniority
  jobTitles: string[]
  languages: string[]
  education: string[]
  certifications: string[]
  preferredLocations: string[]
  workPreferences: string[]
}

export type JobOffer = {
  id: string
  userId: string | null
  title: string
  company: string
  description: string
  requiredSkills: string[]
  preferredSkills: string[]
  minExperienceYears: number | null
  seniority: Seniority
  location: string
  workArrangement: WorkArrangement
  contractType: string
  salaryRange: string
  sourceUrl: string
  isDemo: boolean
  createdAt: string
  updatedAt: string
}

export type ScoreBreakdown = {
  requiredSkills: number | null
  preferredSkills: number | null
  experience: number | null
  seniority: number | null
  semanticFit: number | null
  applicableWeightTotal: number
}

export type JobMatchResult = {
  jobId: string
  jobTitle: string
  company: string
  location: string
  workArrangement: WorkArrangement
  compatibilityScore: number
  matchedSkills: string[]
  missingRequiredSkills: string[]
  missingPreferredSkills: string[]
  semanticFit: number | null
  reasons: string[]
  recommendations: string[]
  gaps: string[]
  scoreBreakdown: ScoreBreakdown
}

export type ExcludedJob = { jobId: string; reason: string }

export type MatchResponsePayload = {
  results: JobMatchResult[]
  totalJobsAnalyzed: number
  totalJobsEligible: number
  excludedJobs: ExcludedJob[]
  weights: Record<string, number>
  algorithm: string
}

/** Snapshot of the jobs used by a session so a later job edit cannot alter it. */
export type MatchJobSnapshot = {
  id: string
  title: string
  company: string
  description: string
  requiredSkills: string[]
  preferredSkills: string[]
  minExperienceYears: number | null
  seniority: Seniority
  location: string
  workArrangement: WorkArrangement
  contractType: string
  educationRequirement: string
  isDemo: boolean
}

export type MatchSession = {
  id: string
  userId: string
  cvId: string
  status: MatchSessionStatus
  profile: CandidateProfile
  jobs: MatchJobSnapshot[]
  topN: number
  results?: MatchResponsePayload
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type MatchProfileRecord = {
  id: string
  userId: string
  cvId: string
  profile: CandidateProfile
  createdAt: string
  updatedAt: string
}

export type MatchSessionSummary = {
  id: string
  cvId: string
  status: MatchSessionStatus
  jobCount: number
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  topScore: number | null
}
