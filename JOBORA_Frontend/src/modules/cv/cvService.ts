import type { AtsValidation, CV } from "./types.ts"

const STORAGE_KEY = "ai-recruiter.cvs"
const API_BASE = (
  (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env
    ?.VITE_API_URL || "http://localhost:3000/api"
).replace(/\/$/, "")

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `cv_${Date.now()}_${Math.random().toString(16).slice(2)}`
const wait = (duration = 450) =>
  new Promise((resolve) => window.setTimeout(resolve, duration))

function currentUserId() {
  try {
    const session = JSON.parse(localStorage.getItem("ai-recruiter.session") || "null")
    return session?.user?.id || "usr_thomas"
  } catch {
    return "usr_thomas"
  }
}

function accessToken() {
  try {
    return JSON.parse(localStorage.getItem("ai-recruiter.session") || "null")?.accessToken as string | undefined
  } catch {
    return undefined
  }
}

async function backendRequest(path: string, init: RequestInit = {}) {
  const token = accessToken()
  if (!token || token.split(".").length !== 3) return null
  try {
    return await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    })
  } catch {
    return null
  }
}

function toApiPayload(cv: CV) {
  const value = cv as CV & { _id?: string; __v?: number }
  const {
    _id: _mongoId,
    __v: _mongoVersion,
    userId: _userId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...payload
  } = value
  void _mongoId
  void _mongoVersion
  void _userId
  void _createdAt
  void _updatedAt
  return payload
}

function normalizeBackendCV(value: CV & { _id?: string; __v?: number }): CV {
  const { _id: _mongoId, __v: _mongoVersion, ...cv } = value
  void _mongoId
  void _mongoVersion
  return {
    ...cv,
    userId: currentUserId(),
    createdAt: cv.createdAt || new Date().toISOString(),
    updatedAt: cv.updatedAt || new Date().toISOString(),
  }
}

async function responseError(response: Response) {
  const body = (await response.json().catch(() => ({}))) as {
    message?: string | string[]
  }
  return Array.isArray(body.message)
    ? body.message[0]
    : body.message || "Le serveur n’a pas pu traiter la demande."
}

export function emptyCV(): CV {
  const now = new Date().toISOString()
  return {
    id: uid(),
    userId: currentUserId(),
    title: "CV sans titre",
    targetJob: "",
    careerObjective: "",
    personalInformation: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      location: "",
      linkedin: "",
      github: "",
    },
    professionalSummary: "",
    education: [],
    experiences: [],
    projects: [],
    technicalSkills: [],
    softSkills: [],
    tools: [],
    languages: [],
    certifications: [],
    atsValidation: null,
    ragMetadata: null,
    generatedContent: null,
    promptVersion: "CV_GENERATE_001_V7",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  }
}

function demoCV(): CV {
  const cv = emptyCV()
  return {
    ...cv,
    id: "cv_demo_fullstack",
    title: "CV Développeur Full-Stack",
    targetJob: "Développeur Full-Stack Junior",
    careerObjective:
      "Rejoindre une équipe produit pour concevoir des applications web utiles et performantes.",
    personalInformation: {
      firstName: "Thomas",
      lastName: "Martin",
      email: "thomas.martin@email.fr",
      phone: "+33 6 12 34 56 78",
      location: "Paris, France",
      linkedin: "linkedin.com/in/thomasmartin",
      github: "github.com/thomasm",
    },
    professionalSummary:
      "Développeur full-stack junior spécialisé en React, TypeScript et Node.js. Expérience en conception d’interfaces réutilisables et d’API REST au sein d’une équipe produit.",
    education: [
      {
        id: uid(),
        degree: "Diplôme d’ingénieur informatique",
        institution: "ESIEA",
        location: "Paris",
        startDate: "2022",
        endDate: "2025",
        description:
          "Spécialisation ingénierie logicielle et systèmes d’information.",
      },
    ],
    experiences: [
      {
        id: uid(),
        jobTitle: "Développeur Full-Stack · Alternance",
        company: "Greenly",
        location: "Paris",
        startDate: "Sept. 2023",
        endDate: "Août 2024",
        rawDescription:
          "Développement de composants React, création d’API REST Node.js et amélioration des performances.",
        bulletPoints: [
          "Développé 12 composants React réutilisables pour la plateforme produit.",
          "Conçu des API REST avec Node.js et PostgreSQL.",
          "Réduit le temps de chargement de 28 % grâce à l’optimisation des requêtes.",
        ],
      },
    ],
    projects: [
      {
        id: uid(),
        name: "JobFlow",
        description:
          "Application de suivi de candidatures avec tableau de bord et rappels.",
        technologies: ["React", "TypeScript", "Node.js"],
        link: "github.com/thomasm/jobflow",
      },
    ],
    technicalSkills: ["React", "TypeScript", "Node.js", "PostgreSQL"],
    softSkills: ["Travail en équipe", "Communication", "Autonomie"],
    tools: ["Git", "Figma", "Docker"],
    languages: [
      { id: uid(), language: "Français", level: "Langue maternelle" },
      { id: uid(), language: "Anglais", level: "B2" },
    ],
    certifications: [
      {
        id: uid(),
        name: "AWS Cloud Practitioner",
        organization: "Amazon Web Services",
        date: "2024",
      },
    ],
    atsValidation: null,
    status: "generated",
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  }
}

function readAll(): CV[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as CV[]
    if (parsed.length) return parsed
  } catch {
    // A corrupt local prototype cache is safely replaced by the demo record.
  }
  const initial = [demoCV()]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial))
  return initial
}

function writeAll(records: CV[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
}

export function validateATS(cv: CV): AtsValidation {
  const issues: string[] = []
  if (!cv.professionalSummary.trim())
    issues.push("Le résumé professionnel est manquant.")
  if (!cv.technicalSkills.length)
    issues.push("Aucune compétence technique n’est renseignée.")
  if (!cv.education.length) issues.push("La section Formation est vide.")
  if (!cv.experiences.length) issues.push("La section Expérience est vide.")
  const longBullet = cv.experiences.some((experience) =>
    experience.bulletPoints.some((bullet) => bullet.length > 180),
  )
  if (longBullet) issues.push("Un point d’expérience dépasse 180 caractères.")
  const score = Math.max(0, 100 - issues.length * 12 - (longBullet ? 4 : 0))
  return {
    status: score >= 75 ? "PASS" : "NEEDS_WORK",
    score,
    checks: {
      standardSections: Boolean(
        cv.professionalSummary &&
          (cv.education.length || cv.experiences.length),
      ),
      readability: !longBullet,
      conciseBulletPoints: !longBullet,
      noGraphics: true,
      noTables: true,
      skillsPresent: cv.technicalSkills.length > 0,
    },
    issues,
    suggestions: issues.length
      ? issues.map((issue) => issue.replace(/\.$/, ""))
      : ["Le CV respecte les règles internes ATS définies par AI Recruiter."],
  }
}

export function exportCvToPdf(printDocument: () => void = () => window.print()) {
  printDocument()
}

export const cvService = {
  async list() {
    const remote = await backendRequest("/cvs")
    if (remote?.ok) {
      const values = (await remote.json()) as Array<CV & { _id?: string }>
      return values.map(normalizeBackendCV)
    }
    await wait(180)
    const userId = currentUserId()
    return readAll().filter((cv) => cv.userId === userId)
  },
  async save(cv: CV) {
    if (cv.userId !== currentUserId()) throw new Error("Ce CV n’appartient pas à l’utilisateur connecté.")
    const payload = JSON.stringify(toApiPayload(cv))
    let remote = await backendRequest(`/cvs/${encodeURIComponent(cv.id)}`, {
      method: "PATCH",
      body: payload,
    })
    if (remote?.status === 404) {
      remote = await backendRequest("/cvs", { method: "POST", body: payload })
    }
    if (remote?.ok) {
      return normalizeBackendCV(
        (await remote.json()) as CV & { _id?: string },
      )
    }
    if (remote && remote.status !== 401) throw new Error(await responseError(remote))
    await wait(220)
    const records = readAll()
    const next = { ...cv, updatedAt: new Date().toISOString() }
    const index = records.findIndex(
      (record) => record.id === next.id && record.userId === next.userId,
    )
    if (index >= 0) records[index] = next
    else records.push(next)
    writeAll(records)
    return next
  },
  async remove(id: string) {
    const remote = await backendRequest(`/cvs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (remote?.ok) return
    if (remote && remote.status !== 401 && remote.status !== 404)
      throw new Error(await responseError(remote))
    await wait(180)
    const userId = currentUserId()
    writeAll(readAll().filter((record) => !(record.id === id && record.userId === userId)))
  },
  async generate(cv: CV) {
    if (!cv.personalInformation.firstName.trim() || !cv.targetJob.trim()) {
      throw new Error(
        "Ajoute au minimum ton prénom et le poste ciblé avant la génération.",
      )
    }
    const saved = await this.save(cv)
    const remote = await backendRequest(
      `/cvs/${encodeURIComponent(saved.id)}/generate`,
      { method: "POST" },
    )
    if (remote?.ok) {
      return normalizeBackendCV(
        (await remote.json()) as CV & { _id?: string },
      )
    }
    if (remote) throw new Error(await responseError(remote))
    throw new Error("Le backend IA est indisponible. La génération Gemini et le RAG s’exécutent uniquement sur le serveur.")
  },
  async regenerateSection(
    cv: CV,
    section: "summary" | "experience" | "project",
    index = 0,
  ) {
    const saved = await this.save(cv)
    const remote = await backendRequest(
      `/cvs/${encodeURIComponent(saved.id)}/regenerate-section`,
      {
        method: "POST",
        body: JSON.stringify({ section, index }),
      },
    )
    if (remote?.ok) {
      return normalizeBackendCV(
        (await remote.json()) as CV & { _id?: string },
      )
    }
    if (remote) throw new Error(await responseError(remote))
    throw new Error("Le backend IA est indisponible. La régénération s’exécute uniquement sur le serveur.")
  },
}
