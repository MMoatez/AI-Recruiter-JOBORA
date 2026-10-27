import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { HistoryPanel } from "./HistoryPanel.tsx"
import { ProfileReview } from "./ProfileReview.tsx"
import type { CandidateProfile, MatchSessionSummary } from "./types.ts"

const profile: CandidateProfile = {
  skills: ["TypeScript", "Node.js"],
  experienceYears: 3,
  seniority: "junior",
  jobTitles: ["Backend Developer"],
  languages: ["French"],
  education: ["Software Engineering"],
  certifications: [],
  preferredLocations: ["Paris"],
  workPreferences: [],
}

test("profile review shows the extracted values as editable fields", () => {
  const html = renderToStaticMarkup(createElement(ProfileReview, {
    profile,
    busy: false,
    onChange: () => undefined,
    onContinue: () => undefined,
  }))
  assert.match(html, /Profil extrait de ton CV/)
  assert.match(html, /TypeScript, Node\.js/)
  assert.match(html, /value="3"/)
  assert.match(html, /Junior \(0–2 ans\)/)
  assert.match(html, /Paris/)
  assert.match(html, /Enregistrer et choisir les offres/)
  assert.match(html, /ne garantit ni entretien ni recrutement/)
})

const sessions: MatchSessionSummary[] = [
  {
    id: "match-ok",
    cvId: "cv-1",
    status: "completed",
    jobCount: 4,
    createdAt: "2026-01-02T10:00:00.000Z",
    updatedAt: "2026-01-02T10:01:00.000Z",
    completedAt: "2026-01-02T10:01:00.000Z",
    topScore: 84,
  },
  {
    id: "match-failed",
    cvId: "cv-1",
    status: "failed",
    jobCount: 1,
    error: "Le service de matching est temporairement indisponible.",
    createdAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:05.000Z",
    topScore: null,
  },
]

test("history renders completed and failed sessions with owner actions", () => {
  const html = renderToStaticMarkup(createElement(HistoryPanel, {
    sessions,
    busyId: "",
    onOpen: () => undefined,
    onDelete: () => undefined,
  }))
  assert.match(html, /Historique des matchings/)
  assert.match(html, /Terminé/)
  assert.match(html, /Meilleur score : 84%/)
  assert.match(html, /Échec/)
  assert.match(html, /temporairement indisponible/)
  assert.match(html, /Ouvrir/)
  assert.match(html, /aria-label="Supprimer le matching du/)
})

test("history handles an empty list", () => {
  const html = renderToStaticMarkup(createElement(HistoryPanel, {
    sessions: [],
    busyId: "",
    onOpen: () => undefined,
    onDelete: () => undefined,
  }))
  assert.match(html, /Aucun matching enregistré/)
  assert.doesNotMatch(html, /Ouvrir/)
})
