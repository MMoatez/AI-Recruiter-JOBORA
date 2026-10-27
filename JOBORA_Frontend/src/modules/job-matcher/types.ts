export type Seniority = "junior" | "mid" | "senior" | "unknown"
export type WorkArrangement = "remote" | "hybrid" | "onsite" | "unknown"
export type MatchSessionStatus = "pending" | "processing" | "completed" | "failed"

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

export type MatchResults = {
  sessionId: string
  cvId: string
  status: MatchSessionStatus
  createdAt: string
  completedAt?: string
  results: JobMatchResult[]
  totalJobsAnalyzed: number
  totalJobsEligible: number
  excludedJobs: ExcludedJob[]
  weights: Record<string, number>
  algorithm: string
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

export type ProfileResponse = {
  cvId: string
  profile: CandidateProfile
  updatedAt: string
}

export type MatchStart = {
  id: string
  cvId: string
  status: MatchSessionStatus
  jobCount: number
  createdAt: string
}

export type MatchStatus = {
  id: string
  cvId: string
  status: MatchSessionStatus
  jobCount: number
  error?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type JobInput = {
  title: string
  company?: string
  description: string
  requiredSkills?: string[]
  preferredSkills?: string[]
  minExperienceYears?: number | null
  seniority?: Seniority
  location?: string
  workArrangement?: WorkArrangement
  contractType?: string
  salaryRange?: string
}
