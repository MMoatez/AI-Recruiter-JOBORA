import type { CV } from "./types.ts"

type GeneratedCV = Pick<CV, "professionalSummary" | "education" | "experiences" | "projects" | "technicalSkills" | "softSkills" | "languages" | "certifications">

export function requireGeminiKey(
  environment: Record<string, string | undefined>,
) {
  const key = environment.GEMINI_API_KEY?.trim()
  if (!key) throw new Error("GEMINI_API_KEY is not configured on the server.")
  return key
}

export function parseGeminiCvResponse(raw: string): GeneratedCV {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Gemini returned invalid JSON.")
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("Gemini returned an invalid CV payload.")
  const value = parsed as Record<string, unknown>
  const arrayFields = [
    "education",
    "experiences",
    "projects",
    "technicalSkills",
    "softSkills",
    "languages",
    "certifications",
  ]
  if (
    typeof value.professionalSummary !== "string" ||
    arrayFields.some((field) => !Array.isArray(value[field]))
  ) {
    throw new Error("Gemini returned an invalid CV payload.")
  }
  return value as GeneratedCV
}
