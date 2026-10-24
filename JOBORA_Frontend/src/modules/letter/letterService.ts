import { entretienRequest, protectedRequest } from "../../services/api"

export type LetterLanguage = "fr" | "en"
export type LetterTone = "formel" | "dynamique" | "creatif"
export type ParagraphRole = "introduction" | "experience" | "fit" | "motivation"
export type RewriteAction = "regenerer" | "raccourcir" | "plus_formel" | "plus_dynamique"

export type LetterParagraph = { role: ParagraphRole; text: string; sources: string[] }
export type LetterFact = { id: string; kind: string; label: string; text: string; score: number }
export type LetterVersion = { label: string; subject: string; paragraphs: LetterParagraph[]; savedAt: string }

export type CoverLetter = {
  id: string
  title: string
  cvId: string | null
  cvTitle: string
  offerText: string
  company: string
  jobTitle: string
  language: LetterLanguage
  tone: LetterTone
  subject: string
  salutation: string
  closing: string
  paragraphs: LetterParagraph[]
  facts: LetterFact[]
  matchedSkills: string[]
  missingSkills: string[]
  warnings: string[]
  versions: LetterVersion[]
  status: "generated" | "edited"
  aiModel: string
  promptVersion: string
  updatedAt: string
}

export type LetterSummary = Pick<CoverLetter, "id" | "title" | "cvTitle" | "company" | "language" | "tone" | "status" | "updatedAt">
export type CvOption = { id: string; title: string; targetJob?: string; status: string }

export type GenerateLetterInput = {
  cvId?: string
  cvText?: string
  offerText: string
  language: LetterLanguage
  tone: LetterTone
  company?: string
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

export const letterService = {
  cvOptions: () => protectedRequest<CvOption[]>("/lettres/cvs"),
  list: () => protectedRequest<LetterSummary[]>("/lettres"),
  get: (id: string) => protectedRequest<CoverLetter>(`/lettres/${id}`),
  generate: (input: GenerateLetterInput) => protectedRequest<CoverLetter>("/lettres", { method: "POST", ...json(input) }),
  save: (id: string, subject: string, paragraphs: LetterParagraph[]) =>
    protectedRequest<CoverLetter>(`/lettres/${id}`, { method: "PATCH", ...json({ subject, paragraphs }) }),
  rewrite: (id: string, index: number, action: RewriteAction) =>
    protectedRequest<CoverLetter>(`/lettres/${id}/paragraphes/${index}/reecrire`, { method: "POST", ...json({ action }) }),
  remove: (id: string) => protectedRequest<{ deleted: boolean }>(`/lettres/${id}`, { method: "DELETE" }),
  /** Réutilise l'extraction PDF du service IA (route du module Entretien). */
  parsePdf: (file: File) => {
    const form = new FormData()
    form.append("file", file)
    return entretienRequest<{ text: string; skills: string[] }>("/cv", { method: "POST", body: form })
  },
}

export function letterPlainText(letter: Pick<CoverLetter, "subject" | "salutation" | "closing">, paragraphs: LetterParagraph[], signature: string) {
  return [
    letter.subject ? `Objet : ${letter.subject}` : "",
    letter.salutation,
    ...paragraphs.map((p) => p.text),
    letter.closing,
    signature,
  ].filter(Boolean).join("\n\n")
}

export function wordCount(paragraphs: LetterParagraph[]) {
  return paragraphs.reduce((total, p) => total + (p.text.trim() ? p.text.trim().split(/\s+/).length : 0), 0)
}
