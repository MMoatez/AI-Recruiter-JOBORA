import assert from "node:assert/strict"
import { beforeEach, test } from "node:test"

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
  clear() { this.values.clear() }
}

Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true })
Object.defineProperty(globalThis, "window", { value: { setTimeout }, configurable: true })

const { jobMatcherService, pollMatch, scoreLabel, scoreTone, splitList, validateCvFile } = await import(
  "./jobMatcherService.ts"
)
const { ApiError } = await import("../../services/api.ts")
import type { CandidateProfile, MatchStatus } from "./types.ts"

const profile: CandidateProfile = {
  skills: ["TypeScript", "Node.js"],
  experienceYears: 3,
  seniority: "junior",
  jobTitles: ["Backend Developer"],
  languages: ["French"],
  education: [],
  certifications: [],
  preferredLocations: [],
  workPreferences: [],
}

const status = (value: MatchStatus["status"], error?: string): MatchStatus => ({
  id: "match-1",
  cvId: "cv-1",
  status: value,
  jobCount: 1,
  error,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
})

const results = {
  sessionId: "match-1",
  cvId: "cv-1",
  status: "completed",
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:10.000Z",
  results: [
    {
      jobId: "job-1",
      jobTitle: "Backend Developer",
      company: "Fixture",
      location: "Paris",
      workArrangement: "hybrid",
      compatibilityScore: 84,
      matchedSkills: ["TypeScript"],
      missingRequiredSkills: ["REST"],
      missingPreferredSkills: ["Docker"],
      semanticFit: 0.9,
      reasons: ["Ton expérience TypeScript correspond."],
      recommendations: ["Ajoute une expérience REST."],
      gaps: ["REST"],
      scoreBreakdown: {
        requiredSkills: 0.75, preferredSkills: 0, experience: 1, seniority: 1,
        semanticFit: 0.9, applicableWeightTotal: 1,
      },
    },
  ],
  totalJobsAnalyzed: 1,
  totalJobsEligible: 1,
  excludedJobs: [],
  weights: { required_skills: 0.4 },
  algorithm: "hybrid",
}

function jsonResponse(body: unknown, statusCode = 200) {
  return new Response(JSON.stringify(body), { status: statusCode, headers: { "Content-Type": "application/json" } })
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    "ai-recruiter.session",
    JSON.stringify({ accessToken: "a.b.c", user: { id: "user_test" } }),
  )
})

test("1. validates PDF type and size before upload", () => {
  assert.equal(validateCvFile({ name: "cv.pdf", type: "application/pdf", size: 1024 }), null)
  assert.match(String(validateCvFile({ name: "cv.exe", type: "application/octet-stream", size: 10 })), /PDF valide/)
  assert.match(String(validateCvFile({ name: "cv.pdf", type: "application/pdf", size: 6 * 1024 * 1024 })), /5 Mo/)
  assert.match(String(validateCvFile({ name: "cv.pdf", type: "application/pdf", size: 0 })), /vide/)
})

test("2. extracts a profile for a selected CV with the bearer token", async () => {
  let captured: { url?: string; init?: RequestInit } = {}
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (url: string, init?: RequestInit) => {
      captured = { url, init }
      return jsonResponse({ cvId: "cv-1", profile, updatedAt: "2026-01-01T00:00:00.000Z" })
    },
  })

  const response = await jobMatcherService.extractProfile("cv-1")
  assert.equal(response.profile.experienceYears, 3)
  assert.match(String(captured.url), /\/job-matcher\/cv$/)
  assert.equal(JSON.parse(String(captured.init?.body)).cvId, "cv-1")
  const headers = new Headers(captured.init?.headers)
  assert.equal(headers.get("Authorization"), "Bearer a.b.c")
})

test("3. lists jobs and adds a pasted offer", async () => {
  const calls: Array<{ url: string; method?: string; body?: string }> = []
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method, body: init?.body ? String(init.body) : undefined })
      if (init?.method === "POST") return jsonResponse({ id: "job-user-1", title: "Dev", isDemo: false })
      return jsonResponse([{ id: "demo-1", title: "Démo", isDemo: true }])
    },
  })

  const jobs = await jobMatcherService.listJobs()
  assert.equal(jobs[0].isDemo, true)

  const created = await jobMatcherService.createJob({
    title: "Dev",
    description: "Une description de poste suffisamment longue.",
    requiredSkills: ["TypeScript"],
  })
  assert.equal(created.id, "job-user-1")
  assert.equal(calls[1].method, "POST")
  assert.equal(JSON.parse(String(calls[1].body)).title, "Dev")
})

test("4. starts a matching session with the selected jobs", async () => {
  let body: Record<string, unknown> = {}
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (_url: string, init?: RequestInit) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return jsonResponse({ id: "match-1", cvId: "cv-1", status: "pending", jobCount: 2, createdAt: "now" })
    },
  })

  const started = await jobMatcherService.startMatch({ cvId: "cv-1", jobIds: ["a", "b"], profile })
  assert.equal(started.status, "pending")
  assert.deepEqual(body.jobIds, ["a", "b"])
  assert.equal((body.profile as typeof profile).skills[0], "TypeScript")
})

test("5. polls until completion and only then loads results", async () => {
  const queue = [status("pending"), status("processing"), status("completed")]
  const seen: string[] = []
  let resultsCalls = 0
  const payload = await pollMatch(
    "match-1",
    {
      getStatus: async () => queue.shift() ?? status("completed"),
      getResults: async () => { resultsCalls += 1; return results as never },
      sleep: async () => undefined,
    },
    { attempts: 5, onStatus: (current) => seen.push(current.status) },
  )
  assert.deepEqual(seen, ["pending", "processing", "completed"])
  assert.equal(resultsCalls, 1)
  assert.equal(payload.results[0].compatibilityScore, 84)
})

test("6. surfaces a failed session without loading results", async () => {
  let resultsCalls = 0
  await assert.rejects(
    () => pollMatch("match-1", {
      getStatus: async () => status("failed", "Le service de matching est temporairement indisponible."),
      getResults: async () => { resultsCalls += 1; return results as never },
      sleep: async () => undefined,
    }),
    (error: unknown) => error instanceof ApiError && error.status === 409 && /indisponible/.test(error.message),
  )
  assert.equal(resultsCalls, 0)
})

test("7. times out when a session never completes", async () => {
  await assert.rejects(
    () => pollMatch("match-1", {
      getStatus: async () => status("processing"),
      getResults: async () => results as never,
      sleep: async () => undefined,
    }, { attempts: 3 }),
    (error: unknown) => error instanceof ApiError && error.status === 408,
  )
})

test("8. deletes only the requested history entry", async () => {
  let method = ""
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (_url: string, init?: RequestInit) => {
      method = String(init?.method)
      return jsonResponse({ deleted: true })
    },
  })
  const deleted = await jobMatcherService.deleteHistory("match-1")
  assert.equal(deleted.deleted, true)
  assert.equal(method, "DELETE")
})

test("9. maps scores to readable labels and splits corrected lists", () => {
  assert.equal(scoreTone(80), "success")
  assert.equal(scoreTone(60), "warning")
  assert.equal(scoreTone(20), "neutral")
  assert.equal(scoreLabel(80), "Correspondance forte")
  assert.equal(scoreLabel(20), "Correspondance faible")
  assert.deepEqual(splitList(" React, TypeScript ,, Node.js "), ["React", "TypeScript", "Node.js"])
})
