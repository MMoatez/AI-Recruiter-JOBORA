export const letterRoles = ["introduction", "experience", "fit", "motivation"] as const
export const letterLanguages = ["fr", "en"] as const
export const letterTones = ["formel", "dynamique", "creatif"] as const
export type LetterParagraph = { role: string; text: string; sources: string[] }
export type LetterVersion = { label: string; subject: string; paragraphs: LetterParagraph[]; savedAt: Date | string }
export type CoverLetter = {
	id: string
	userId: string
	title: string
	cvId: string | null
	cvTitle: string
	offerText: string
	company: string
	jobTitle: string
	language: string
	tone: string
	subject: string
	salutation: string
	closing: string
	paragraphs: LetterParagraph[]
	facts: Record<string, unknown>[]
	matchedSkills: string[]
	missingSkills: string[]
	warnings: string[]
	versions: LetterVersion[]
	status: "generated" | "edited"
	aiModel: string
	promptVersion: string
	createdAt: string
	updatedAt: string
	save(): Promise<CoverLetter>
	markModified(path: string): void
}
export type CoverLetterDocument = CoverLetter
