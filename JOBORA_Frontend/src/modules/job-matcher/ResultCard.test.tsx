import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ResultCard } from "./ResultCard.tsx"
import type { JobMatchResult, JobOffer } from "./types.ts"

const result: JobMatchResult = {
  jobId: "job-1",
  jobTitle: "Backend Developer",
  company: "Fixture Co",
  location: "Paris",
  workArrangement: "hybrid",
  compatibilityScore: 84,
  matchedSkills: ["TypeScript", "Node.js"],
  missingRequiredSkills: ["REST"],
  missingPreferredSkills: ["Docker"],
  semanticFit: 0.9,
  reasons: ["Ton expérience TypeScript correspond au poste."],
  recommendations: [],
  gaps: ["REST"],
  scoreBreakdown: {
    requiredSkills: 0.75,
    preferredSkills: 0,
    experience: 1,
    seniority: 1,
    semanticFit: 0.9,
    applicableWeightTotal: 1,
  },
}

const job: JobOffer = {
  id: "job-1",
  title: "Backend Developer",
  company: "Fixture Co",
  description: "Build APIs",
  requiredSkills: ["TypeScript"],
  preferredSkills: ["Docker"],
  minExperienceYears: 2,
  seniority: "junior",
  location: "Paris",
  workArrangement: "hybrid",
  contractType: "CDI",
  salaryRange: "",
  sourceUrl: "",
  isDemo: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}

function render(selected = false, offer: JobOffer = job, match = result) {
  return renderToStaticMarkup(createElement(ResultCard, {
    result: match,
    job: offer,
    rank: 1,
    selected,
    onSelect: () => undefined,
  }))
}

test("renders the ranked score, matched and missing skills", () => {
  const html = render()
  assert.match(html, /Backend Developer/)
  assert.match(html, /Fixture Co/)
  assert.match(html, /84%/)
  assert.match(html, /Correspondance forte/)
  assert.match(html, /Compétences validées/)
  assert.match(html, /TypeScript/)
  assert.match(html, /Compétences requises manquantes/)
  assert.match(html, /REST/)
  assert.match(html, /Compétences appréciées manquantes/)
  assert.match(html, /Docker/)
  assert.match(html, /Ton expérience TypeScript correspond au poste\./)
  assert.match(html, /Voir le détail/)
})

test("labels demo fixtures and never renders a fabricated application link", () => {
  const demo = { ...job, id: "demo-1", isDemo: true, sourceUrl: "" }
  const html = render(true, demo)
  assert.match(html, /Offre de démonstration/)
  assert.match(html, /Offre fictive/)
  assert.doesNotMatch(html, /<a /)
  assert.match(html, /Détail affiché/)
})

test("renders an external link only when an owned offer provides one", () => {
  const html = render(false, { ...job, sourceUrl: "https://example.test/offre" })
  assert.match(html, /href="https:\/\/example\.test\/offre"/)
  assert.match(html, /rel="noreferrer noopener"/)
})

test("handles a result with no matched skills and no semantic score", () => {
  const empty = {
    ...result,
    matchedSkills: [],
    reasons: [],
    missingRequiredSkills: [],
    missingPreferredSkills: [],
    semanticFit: null,
  }
  const html = render(false, job, empty)
  assert.match(html, /Aucune compétence commune identifiée/)
  assert.match(html, /Aucune lacune sur les compétences requises/)
  assert.doesNotMatch(html, /Analyse sémantique/)
})
