import type { JobOffer } from "./job-matcher.types"

const DEMO_DATE = "2026-01-01T00:00:00.000Z"

function demoJob(input: Omit<JobOffer, "userId" | "isDemo" | "createdAt" | "updatedAt" | "sourceUrl">): JobOffer {
  return { ...input, userId: null, sourceUrl: "", isDemo: true, createdAt: DEMO_DATE, updatedAt: DEMO_DATE }
}

/**
 * Clearly fictional postings used to exercise the matcher without a live job
 * board. They are never persisted and always returned with `isDemo: true` so
 * the UI can label them as examples.
 */
export const DEMO_JOBS: JobOffer[] = [
  demoJob({
    id: "demo-backend-node",
    title: "Développeur Backend Node.js (démo)",
    company: "Atelier Démo",
    description:
      "Nous cherchons un développeur backend pour concevoir des API REST et maintenir des services Node.js. " +
      "Stack : TypeScript, Node.js, Express, PostgreSQL, Docker. 2 ans d'expérience attendus. " +
      "Poste hybride basé à Paris. CDI.",
    requiredSkills: ["TypeScript", "Node.js", "REST", "PostgreSQL"],
    preferredSkills: ["Docker", "CI/CD"],
    minExperienceYears: 2,
    seniority: "junior",
    location: "Paris, France",
    workArrangement: "hybrid",
    contractType: "CDI",
    salaryRange: "40 000 – 48 000 € brut/an",
  }),
  demoJob({
    id: "demo-frontend-react",
    title: "Développeur Frontend React (démo)",
    company: "Studio Démo",
    description:
      "Rejoignez une équipe produit pour construire des interfaces accessibles avec React et TypeScript. " +
      "Vous travaillerez avec Vite, CSS moderne et des tests automatisés. 3 ans d'expérience. Télétravail complet.",
    requiredSkills: ["React", "TypeScript", "CSS", "Accessibilité"],
    preferredSkills: ["Vite", "Tests automatisés"],
    minExperienceYears: 3,
    seniority: "mid",
    location: "France",
    workArrangement: "remote",
    contractType: "CDI",
    salaryRange: "45 000 – 55 000 € brut/an",
  }),
  demoJob({
    id: "demo-data-python",
    title: "Data Analyst Python (démo)",
    company: "Données Démo",
    description:
      "Analyse de données produit avec Python, pandas et SQL. Vous construirez des tableaux de bord et " +
      "présenterez vos résultats aux équipes métier. 2 ans d'expérience minimum, anglais professionnel. Sur site à Lyon.",
    requiredSkills: ["Python", "SQL", "Pandas"],
    preferredSkills: ["Power BI", "Statistiques"],
    minExperienceYears: 2,
    seniority: "junior",
    location: "Lyon, France",
    workArrangement: "onsite",
    contractType: "CDI",
    salaryRange: "38 000 – 45 000 € brut/an",
  }),
  demoJob({
    id: "demo-devops",
    title: "Ingénieur DevOps (démo)",
    company: "Cloud Démo",
    description:
      "Automatisation d'infrastructures cloud, pipelines CI/CD et supervision. Maîtrise de Docker, Kubernetes, " +
      "Terraform et Linux requise. 5 ans d'expérience, poste senior en hybride à Nantes.",
    requiredSkills: ["Docker", "Kubernetes", "Terraform", "Linux", "CI/CD"],
    preferredSkills: ["AWS", "Prometheus"],
    minExperienceYears: 5,
    seniority: "senior",
    location: "Nantes, France",
    workArrangement: "hybrid",
    contractType: "CDI",
    salaryRange: "60 000 – 70 000 € brut/an",
  }),
]
