/**
 * Anonymisation avant tout appel IA (exigence du cahier des charges :
 * « jamais de données personnelles brutes envoyées telles quelles au LLM »).
 */

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g
const URL = /(https?:\/\/\S+|www\.\S+|\b(?:linkedin|github)\.com\/\S*)/gi
const PHONE = /(?<!\w)\+?\d[\d .-]{7,}\d(?!\w)/g

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Retire emails, liens, téléphones et les mots d'identité connus (nom, prénom...). */
export function scrubText(text: string, identity: string[] = []): string {
  let result = (text || "").replace(EMAIL, "").replace(URL, "").replace(PHONE, "")
  const words = identity
    .flatMap((value) => (value || "").split(/\s+/))
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
  for (const word of new Set(words)) {
    result = result.replace(new RegExp(`(?<![\\p{L}])${escapeRegExp(word)}(?![\\p{L}])`, "giu"), "")
  }
  return result.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim()
}

function scrubDeep(value: unknown, identity: string[]): unknown {
  if (typeof value === "string") return scrubText(value, identity)
  if (Array.isArray(value)) return value.map((item) => scrubDeep(item, identity))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !["link", "url", "_id", "__v", "id"].includes(key))
        .map(([key, item]) => [key, scrubDeep(item, identity)]),
    )
  }
  return value
}

/** Valeurs d'identité à effacer : champs texte de personalInformation + nom/email du compte. */
export function identityValues(personalInformation: unknown, user?: { name?: string; email?: string }): string[] {
  const values: string[] = []
  if (personalInformation && typeof personalInformation === "object") {
    for (const [key, value] of Object.entries(personalInformation as Record<string, unknown>)) {
      if (typeof value === "string" && /name|nom|prenom|prénom/i.test(key)) values.push(value)
    }
  }
  if (user?.name) values.push(user.name)
  return values
}

type CvLike = {
  targetJob?: string
  careerObjective?: string
  professionalSummary?: string
  personalInformation?: unknown
  education?: unknown[]
  experiences?: unknown[]
  projects?: unknown[]
  technicalSkills?: string[]
  softSkills?: string[]
  tools?: string[]
  languages?: unknown[]
  certifications?: unknown[]
  generatedContent?: Record<string, unknown> | null
}

/**
 * Construit les faits professionnels envoyés au service IA.
 * personalInformation n'est JAMAIS transmis ; si le CV a été généré, on privilégie
 * le contenu reformulé (déjà validé par le module CV).
 */
export function sanitizeCv(cv: CvLike, user?: { name?: string; email?: string }) {
  const identity = identityValues(cv.personalInformation, user)
  const generated = (cv.generatedContent || {}) as Record<string, unknown>
  const pick = <T>(key: string, fallback: T): T => {
    const value = generated[key]
    return (Array.isArray(value) ? (value.length ? value : fallback) : value || fallback) as T
  }
  return scrubDeep(
    {
      target_job: cv.targetJob || "",
      career_objective: cv.careerObjective || "",
      summary: pick("professionalSummary", cv.professionalSummary || ""),
      education: pick("education", cv.education || []),
      experiences: pick("experiences", cv.experiences || []),
      projects: pick("projects", cv.projects || []),
      technical_skills: pick("technicalSkills", cv.technicalSkills || []),
      tools: cv.tools || [],
      soft_skills: pick("softSkills", cv.softSkills || []),
      languages: pick("languages", cv.languages || []),
      certifications: pick("certifications", cv.certifications || []),
      raw_text: "",
    },
    identity,
  ) as Record<string, unknown>
}
