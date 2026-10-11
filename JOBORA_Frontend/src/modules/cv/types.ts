export type PersonalInformation = {
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  linkedin: string
  github: string
}

export type EducationEntry = {
  id: string
  degree: string
  institution: string
  location: string
  startDate: string
  endDate: string
  description: string
}

export type ExperienceEntry = {
  id: string
  jobTitle: string
  company: string
  location: string
  startDate: string
  endDate: string
  rawDescription: string
  bulletPoints: string[]
}

export type ProjectEntry = {
  id: string
  name: string
  description: string
  technologies: string[]
  link: string
}

export type LanguageEntry = {
  id: string
  language: string
  level: string
}
export type CertificationEntry = {
  id: string
  name: string
  organization: string
  date: string
}

export type AtsValidation = {
  status: "PASS" | "NEEDS_WORK"
  score: number
  checks: {
    standardSections: boolean
    readability: boolean
    conciseBulletPoints: boolean
    noGraphics: boolean
    noTables: boolean
    skillsPresent: boolean
  }
  issues: string[]
  suggestions: string[]
}

export type CV = {
  id: string
  userId: string
  title: string
  targetJob: string
  careerObjective: string
  personalInformation: PersonalInformation
  professionalSummary: string
  education: EducationEntry[]
  experiences: ExperienceEntry[]
  projects: ProjectEntry[]
  technicalSkills: string[]
  softSkills: string[]
  tools: string[]
  languages: LanguageEntry[]
  certifications: CertificationEntry[]
  atsValidation: AtsValidation | null
  promptVersion: string
  status: "draft" | "generated"
  createdAt: string
  updatedAt: string
}
