import type { PortfolioData, PortfolioRecord } from "../../api/portfolioApi"

export function createPortfolioData(): PortfolioData {
  return {
    fullName: "Fatma Ben Ali",
    title: "Développeuse full-stack",
    headline: "Je crée des applications web accessibles et performantes",
    availableForWork: true,
    showCvDownload: false,
    email: "fatma@example.test",
    phone: "+33123456789",
    location: "Paris",
    links: { linkedin: "", github: "", website: "" },
    sections: [
      { id: "home", visible: true, order: 0 },
      { id: "about", visible: true, order: 1 },
      { id: "skills", visible: true, order: 2 },
      { id: "experiences", visible: true, order: 3 },
      { id: "projects", visible: true, order: 4 },
      { id: "certifications", visible: true, order: 5 },
      { id: "contact", visible: true, order: 6 },
    ],
    theme: { accentColor: "#5b5bd6" },
    contactVisibility: { email: false, phone: false },
    about: "Je conçois des expériences numériques utiles.",
    education: [],
    experiences: [{
      company: "Studio Exemple",
      role: "Développeuse",
      startDate: "2024",
      endDate: "2025",
      description: "Développement d’applications web.",
      technologies: ["React"],
    }],
    projects: [{
      name: "Jobora",
      year: "2026",
      description: "Une plateforme de recherche d’emploi.",
      technologies: ["React", "NestJS"],
    }],
    skills: { languages: ["TypeScript"], frameworks: ["React"], tools: [], databases: [], other: [] },
    languages: [],
    certifications: [],
  }
}

export function createPortfolioRecord(data = createPortfolioData()): PortfolioRecord {
  return {
    _id: "portfolio-test-id",
    data,
    templateId: "developer",
    slug: "fatma-ben-ali",
    status: "draft",
    publishedAt: null,
    lastSyncedAt: null,
    sourceCvName: "",
    removedItems: [],
  }
}
