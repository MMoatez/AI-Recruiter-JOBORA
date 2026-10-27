import { ApiError, protectedRequest } from "../../services/api"
import type {
  CandidateProfile,
  JobInput,
  JobOffer,
  MatchResults,
  MatchSessionSummary,
  MatchStart,
  MatchStatus,
  ProfileResponse,
} from "./types"

export type FileLike = { name: string; type: string; size: number }

export function validateCvFile(file: FileLike): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  if (!isPdf) return "Choisis un fichier PDF valide."
  if (file.size <= 0) return "Le fichier est vide."
  if (file.size > 5 * 1024 * 1024) return "Le PDF ne doit pas dépasser 5 Mo."
  return null
}

export function scoreTone(score: number): "success" | "warning" | "neutral" {
  if (score >= 75) return "success"
  if (score >= 50) return "warning"
  return "neutral"
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "Correspondance forte"
  if (score >= 50) return "Correspondance moyenne"
  return "Correspondance faible"
}

export const statusLabel: Record<MatchStatus["status"], string> = {
  pending: "En attente",
  processing: "En cours",
  completed: "Terminé",
  failed: "Échec",
}

export const jobMatcherService = {
  extractProfile: (cvId: string) =>
    protectedRequest<ProfileResponse>("/job-matcher/cv", {
      method: "POST",
      body: JSON.stringify({ cvId }),
    }),

  getProfile: (cvId: string) =>
    protectedRequest<ProfileResponse>(`/job-matcher/profile/${encodeURIComponent(cvId)}`),

  saveProfile: (cvId: string, profile: CandidateProfile) =>
    protectedRequest<ProfileResponse>(`/job-matcher/profile/${encodeURIComponent(cvId)}`, {
      method: "PUT",
      body: JSON.stringify({ profile }),
    }),

  listJobs: () => protectedRequest<JobOffer[]>("/job-matcher/jobs"),

  createJob: (input: JobInput) =>
    protectedRequest<JobOffer>("/job-matcher/jobs", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  startMatch: (input: { cvId: string; jobIds: string[]; profile?: CandidateProfile; topN?: number }) =>
    protectedRequest<MatchStart>("/job-matcher/match", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getStatus: (id: string) =>
    protectedRequest<MatchStatus>(`/job-matcher/status/${encodeURIComponent(id)}`),

  getResults: (id: string) =>
    protectedRequest<MatchResults>(`/job-matcher/results/${encodeURIComponent(id)}`),

  history: () => protectedRequest<MatchSessionSummary[]>("/job-matcher/history"),

  deleteHistory: (id: string) =>
    protectedRequest<{ deleted: true }>(`/job-matcher/history/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
}

export type PollDeps = {
  getStatus: (id: string) => Promise<MatchStatus>
  getResults: (id: string) => Promise<MatchResults>
  sleep?: (ms: number) => Promise<void>
}

/**
 * Polls a matching session until it completes, fails, or exceeds the deadline.
 * The result payload is only returned after a `completed` status.
 */
export async function pollMatch(
  id: string,
  deps: PollDeps = { getStatus: jobMatcherService.getStatus, getResults: jobMatcherService.getResults },
  options: { attempts?: number; intervalMs?: number; onStatus?: (status: MatchStatus) => void } = {},
): Promise<MatchResults> {
  const attempts = options.attempts ?? 80
  const intervalMs = options.intervalMs ?? 1500
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const status = await deps.getStatus(id)
    options.onStatus?.(status)
    if (status.status === "completed") return deps.getResults(id)
    if (status.status === "failed") {
      throw new ApiError(409, status.error || "Le matching a échoué. Relance une analyse.")
    }
    await sleep(intervalMs)
  }
  throw new ApiError(408, "Le matching prend plus de temps que prévu. Réessaie dans un instant.")
}

export function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}
