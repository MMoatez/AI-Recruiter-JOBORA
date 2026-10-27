import { protectedRequest } from "../../services/api"

export type JobMatch = { title: string; score: number }

export type MatchingResult = {
  compatibility_score: number
  top_job_matches: JobMatch[]
  algorithm: string
}

export type MatchingInput = {
  cvId: string
  jobDescription: string
}

export const matchingService = {
  analyze: (input: MatchingInput) =>
    protectedRequest<MatchingResult>("/matching/analyze", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  upload: async (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return protectedRequest<{ cv: import("../cv/types").CV; extractedTextLength: number }>("/matching/upload", { method: "POST", body: form })
  },
}
