import { ApiError, apiRequest } from "../services/api"
import type { CV } from "../modules/cv/types"

export type PortfolioSectionId =
  | "home"
  | "about"
  | "skills"
  | "experiences"
  | "projects"
  | "certifications"
  | "contact"

export interface SectionConfig {
  id: PortfolioSectionId
  visible: boolean
  order: number
}

export interface Theme {
  accentColor: string
}

export interface PortfolioLinks {
  linkedin: string
  github: string
  website: string
}

export interface PortfolioEducation {
  school: string
  degree: string
  field: string
  startYear: string
  endYear: string
}

export interface PortfolioExperience {
  company: string
  role: string
  startDate: string
  endDate: string
  description: string
  technologies: string[]
}

export interface PortfolioProject {
  name: string
  year: string
  description: string
  technologies: string[]
}

export interface PortfolioSkills {
  languages: string[]
  frameworks: string[]
  tools: string[]
  databases: string[]
  other: string[]
}

export interface PortfolioLanguage {
  name: string
  level: string
}

export interface PortfolioCertification {
  name: string
  issuer: string
  year: string
}

export interface ContactVisibility {
  email: boolean
  phone: boolean
}

export interface PortfolioData {
  fullName: string
  title: string
  headline: string
  availableForWork: boolean
  showCvDownload: boolean
  email: string
  phone: string
  location: string
  links: PortfolioLinks
  sections: SectionConfig[]
  theme: Theme
  contactVisibility: ContactVisibility
  about: string
  education: PortfolioEducation[]
  experiences: PortfolioExperience[]
  projects: PortfolioProject[]
  skills: PortfolioSkills
  languages: PortfolioLanguage[]
  certifications: PortfolioCertification[]
}

export type PortfolioTemplateId =
  | "developer"
  | "student"
  | "minimal"
  | "modern"
  | "professional"

export interface PortfolioRecord {
  _id?: string
  data: PortfolioData
  templateId: PortfolioTemplateId
  slug?: string
  status: "draft" | "published"
  publishedAt: string | null
  lastSyncedAt: string | null
  sourceCvName: string
  removedItems: string[]
  createdAt?: string
  updatedAt?: string
}

export type PublicPortfolioData = Omit<PortfolioData, "contactVisibility" | "email" | "phone"> & {
  email?: string
  phone?: string
}

export interface PublicPortfolio {
  slug: string
  templateId: PortfolioTemplateId
  status: "published"
  publishedAt: string | null
  data: PublicPortfolioData
}

export interface RankedProjectsResult {
  portfolio: PortfolioRecord
  scores: Array<{ projectName: string; score: number }>
}

export interface ExtractedPortfolio {
  cleaned: PortfolioData
  removedItems: Array<{ field: string; value: string }>
}

export { ApiError }

export async function getMyPortfolio(): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me")
}

export async function generatePortfolio(file: File): Promise<PortfolioRecord> {
  const formData = new FormData()
  formData.append("file", file)
  return apiRequest<PortfolioRecord>("/portfolio/generate", {
    method: "POST",
    body: formData,
  })
}

export async function extractPortfolioFromCv(cvText: string): Promise<ExtractedPortfolio> {
  return apiRequest<ExtractedPortfolio>("/portfolio/extract-cv", {
    method: "POST",
    body: JSON.stringify({ cvText }),
  })
}

export function portfolioSourceTextFromCv(cv: CV): string {
  const personal = cv.personalInformation
  return [
    `${personal.firstName} ${personal.lastName}`.trim(),
    cv.title,
    cv.targetJob,
    cv.careerObjective,
    personal.email,
    personal.phone,
    personal.location,
    personal.linkedin,
    personal.github,
    cv.professionalSummary,
    ...cv.education.flatMap((item) => [
      item.institution,
      item.degree,
      item.location,
      item.startDate,
      item.endDate,
      item.description,
    ]),
    ...cv.experiences.flatMap((item) => [
      item.company,
      item.jobTitle,
      item.location,
      item.startDate,
      item.endDate,
      item.rawDescription,
      ...item.bulletPoints,
    ]),
    ...cv.projects.flatMap((item) => [item.name, item.description, item.link, ...item.technologies]),
    ...cv.technicalSkills,
    ...cv.softSkills,
    ...cv.tools,
    ...cv.languages.flatMap((item) => [item.language, item.level]),
    ...cv.certifications.flatMap((item) => [item.name, item.organization, item.date]),
  ].filter(Boolean).join("\n")
}

export async function updatePortfolio(data: PortfolioData): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me", {
    method: "PUT",
    body: JSON.stringify(data),
  })
}

export async function setTemplate(templateId: PortfolioTemplateId): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me/template", {
    method: "PATCH",
    body: JSON.stringify({ templateId }),
  })
}

export async function regenerateAbout(): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me/regenerate-about", { method: "POST" })
}

export async function syncPortfolio(): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me/sync", { method: "POST" })
}

export async function publishPortfolio(): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me/publish", { method: "POST" })
}

export async function unpublishPortfolio(): Promise<PortfolioRecord> {
  return apiRequest<PortfolioRecord>("/portfolio/me/unpublish", { method: "POST" })
}

export async function rankProjects(jobText: string): Promise<RankedProjectsResult> {
  return apiRequest<RankedProjectsResult>("/portfolio/me/rank-projects", {
    method: "POST",
    body: JSON.stringify({ jobText }),
  })
}

export async function getPublicPortfolio(slug: string): Promise<PublicPortfolio> {
  return apiRequest<PublicPortfolio>(
    `/public/portfolio/${encodeURIComponent(slug)}`,
    {},
    { authenticated: false },
  )
}
