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
  sections: PortfolioSection[]
  theme: PortfolioTheme
  contactVisibility: PortfolioContactVisibility
  about: string
  education: PortfolioEducation[]
  experiences: PortfolioExperience[]
  projects: PortfolioProject[]
  skills: PortfolioSkills
  languages: PortfolioLanguage[]
  certifications: PortfolioCertification[]
}

export type PortfolioSectionId = "home" | "about" | "skills" | "experiences" | "projects" | "certifications" | "contact"

export interface PortfolioSection {
  id: PortfolioSectionId
  visible: boolean
  order: number
}

export interface PortfolioTheme {
  accentColor: string
}

export interface PortfolioContactVisibility {
  email: boolean
  phone: boolean
}

export interface PortfolioDataPartial {
  fullName?: string
  title?: string
  headline?: string
  availableForWork?: boolean
  showCvDownload?: boolean
  email?: string
  phone?: string
  location?: string
  links?: Partial<PortfolioLinks>
  sections?: Partial<PortfolioSection>[]
  theme?: Partial<PortfolioTheme>
  contactVisibility?: Partial<PortfolioContactVisibility>
  about?: string
  education?: Partial<PortfolioEducation>[]
  experiences?: Partial<PortfolioExperience>[]
  projects?: Partial<PortfolioProject>[]
  skills?: Partial<PortfolioSkills>
  languages?: Partial<PortfolioLanguage>[]
  certifications?: Partial<PortfolioCertification>[]
}

export interface RemovedPortfolioItem {
  field: string
  value: string
}

export interface SourceValidationResult {
  cleaned: PortfolioData
  removedItems: RemovedPortfolioItem[]
}

export function emptyPortfolioData(): PortfolioData {
  return {
    fullName: "",
    title: "",
    headline: "",
    availableForWork: true,
    showCvDownload: false,
    email: "",
    phone: "",
    location: "",
    links: { linkedin: "", github: "", website: "" },
    sections: defaultPortfolioSections(),
    theme: { accentColor: "#5b5bd6" },
    contactVisibility: { email: false, phone: false },
    about: "",
    education: [],
    experiences: [],
    projects: [],
    skills: { languages: [], frameworks: [], tools: [], databases: [], other: [] },
    languages: [],
    certifications: [],
  }
}

export function defaultPortfolioSections(): PortfolioSection[] {
  return [
    { id: "home", visible: true, order: 0 },
    { id: "about", visible: true, order: 1 },
    { id: "skills", visible: true, order: 2 },
    { id: "experiences", visible: true, order: 3 },
    { id: "projects", visible: true, order: 4 },
    { id: "certifications", visible: true, order: 5 },
    { id: "contact", visible: true, order: 6 },
  ]
}

export function validateAgainstSource(data: PortfolioData, cvText: string): SourceValidationResult {
  const source = normalizeForSourceMatch(cvText)
  const removedItems: RemovedPortfolioItem[] = []
  const keepIfInSource = (field: string, value: string): boolean => {
    const normalizedValue = normalizeForSourceMatch(value)
    if (normalizedValue && source.includes(normalizedValue)) return true
    removedItems.push({ field, value })
    return false
  }

  const education = data.education.flatMap((item, index) =>
    keepIfInSource(`education[${index}].school`, item.school) ? [{ ...item }] : [],
  )
  const experiences = data.experiences.flatMap((item, index) => {
    if (!keepIfInSource(`experiences[${index}].company`, item.company)) return []
    return [{
      ...item,
      technologies: item.technologies.filter((technology, technologyIndex) =>
        keepIfInSource(`experiences[${index}].technologies[${technologyIndex}]`, technology),
      ),
    }]
  })
  const projects = data.projects.flatMap((item, index) => {
    if (!keepIfInSource(`projects[${index}].name`, item.name)) return []
    return [{
      ...item,
      technologies: item.technologies.filter((technology, technologyIndex) =>
        keepIfInSource(`projects[${index}].technologies[${technologyIndex}]`, technology),
      ),
    }]
  })

  const cleaned: PortfolioData = {
    ...data,
    links: { ...data.links },
    education,
    experiences,
    projects,
    skills: {
      languages: filterSkills("skills.languages", data.skills.languages, keepIfInSource),
      frameworks: filterSkills("skills.frameworks", data.skills.frameworks, keepIfInSource),
      tools: filterSkills("skills.tools", data.skills.tools, keepIfInSource),
      databases: filterSkills("skills.databases", data.skills.databases, keepIfInSource),
      other: filterSkills("skills.other", data.skills.other, keepIfInSource),
    },
    languages: data.languages.map((item) => ({ ...item })),
    certifications: data.certifications.map((item) => ({ ...item })),
  }

  return { cleaned, removedItems }
}

function filterSkills(
  field: string,
  values: string[],
  keepIfInSource: (field: string, value: string) => boolean,
): string[] {
  return values.filter((value, index) => keepIfInSource(`${field}[${index}]`, value))
}

function normalizeForSourceMatch(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase().replace(/\s+/g, " ").trim()
}

export function normalize(partial: PortfolioDataPartial): PortfolioData {
  const empty = emptyPortfolioData()
  return {
    fullName: partial.fullName ?? empty.fullName,
    title: partial.title ?? empty.title,
    headline: partial.headline ?? empty.headline,
    availableForWork: partial.availableForWork ?? empty.availableForWork,
    showCvDownload: partial.showCvDownload ?? empty.showCvDownload,
    email: partial.email ?? empty.email,
    phone: partial.phone ?? empty.phone,
    location: partial.location ?? empty.location,
    links: {
      linkedin: partial.links?.linkedin ?? empty.links.linkedin,
      github: partial.links?.github ?? empty.links.github,
      website: partial.links?.website ?? empty.links.website,
    },
    sections: (partial.sections ?? empty.sections).map((section, index) => ({
      id: section.id ?? empty.sections[index]?.id ?? "home",
      visible: section.visible ?? true,
      order: section.order ?? index,
    })),
    theme: {
      accentColor: partial.theme?.accentColor ?? empty.theme.accentColor,
    },
    contactVisibility: {
      email: partial.contactVisibility?.email ?? empty.contactVisibility.email,
      phone: partial.contactVisibility?.phone ?? empty.contactVisibility.phone,
    },
    about: partial.about ?? empty.about,
    education: (partial.education ?? []).map((item) => ({
      school: item.school ?? "",
      degree: item.degree ?? "",
      field: item.field ?? "",
      startYear: item.startYear ?? "",
      endYear: item.endYear ?? "",
    })),
    experiences: (partial.experiences ?? []).map((item) => ({
      company: item.company ?? "",
      role: item.role ?? "",
      startDate: item.startDate ?? "",
      endDate: item.endDate ?? "",
      description: item.description ?? "",
      technologies: item.technologies ?? [],
    })),
    projects: (partial.projects ?? []).map((item) => ({
      name: item.name ?? "",
      year: item.year ?? "",
      description: item.description ?? "",
      technologies: item.technologies ?? [],
    })),
    skills: {
      languages: partial.skills?.languages ?? empty.skills.languages,
      frameworks: partial.skills?.frameworks ?? empty.skills.frameworks,
      tools: partial.skills?.tools ?? empty.skills.tools,
      databases: partial.skills?.databases ?? empty.skills.databases,
      other: partial.skills?.other ?? empty.skills.other,
    },
    languages: (partial.languages ?? []).map((item) => ({
      name: item.name ?? "",
      level: item.level ?? "",
    })),
    certifications: (partial.certifications ?? []).map((item) => ({
      name: item.name ?? "",
      issuer: item.issuer ?? "",
      year: item.year ?? "",
    })),
  }
}
