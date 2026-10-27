import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { JobMatcherAiClient } from "./job-matcher-ai.client"
import type { CandidateProfile, MatchJobSnapshot } from "./job-matcher.types"

const TOKEN = "internal-test-token"

const profile: CandidateProfile = {
  skills: ["Python", "FastAPI"],
  experienceYears: 2,
  seniority: "junior",
  jobTitles: ["Developer"],
  languages: ["French"],
  education: [],
  certifications: [],
  preferredLocations: [],
  workPreferences: [],
}

const job: MatchJobSnapshot = {
  id: "job-1",
  title: "Backend Developer",
  company: "Fixture",
  description: "Python APIs",
  requiredSkills: ["Python"],
  preferredSkills: ["Docker"],
  minExperienceYears: 2,
  seniority: "junior",
  location: "Paris",
  workArrangement: "hybrid",
  contractType: "CDI",
  educationRequirement: "",
  isDemo: true,
}

function client(overrides: Record<string, unknown> = {}) {
  return new JobMatcherAiClient(new ConfigService({
    JOB_MATCHER_AI_SERVICE_URL: "http://127.0.0.1:8010/",
    JOB_MATCHER_INTERNAL_TOKEN: TOKEN,
    JOB_MATCHER_AI_TIMEOUT_MS: 5000,
    ...overrides,
  }))
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })
}

const profilePayload = {
  profile: {
    skills: ["Python"],
    experience_years: 3,
    seniority: "mid",
    job_titles: ["Developer"],
    languages: ["English"],
    education: ["MSc"],
    certifications: [],
    preferred_locations: ["Paris"],
    work_preferences: ["remote"],
  },
  extracted_text_length: 120,
  redacted: true,
}

const matchPayload = {
  results: [
    {
      job_id: "job-1",
      job_title: "Backend Developer",
      company: "Fixture",
      location: "Paris",
      work_arrangement: "hybrid",
      compatibility_score: 84,
      matched_skills: ["Python"],
      missing_required_skills: [],
      missing_preferred_skills: ["Docker"],
      semantic_fit: 0.9,
      reasons: ["Python correspond."],
      recommendations: ["Ajouter Docker."],
      gaps: [],
      score_breakdown: {
        required_skills: 1,
        preferred_skills: 0,
        experience: 1,
        seniority: 1,
        semantic_fit: 0.9,
        applicable_weight_total: 1,
      },
    },
  ],
  total_jobs_analyzed: 1,
  total_jobs_eligible: 1,
  excluded_jobs: [],
  weights: { required_skills: 0.4 },
  algorithm: "hybrid",
}

describe("JobMatcherAiClient", () => {
  afterEach(() => jest.restoreAllMocks())

  it("parses a CV through the internal endpoint and maps the profile", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(profilePayload))
    const result = await client().parseCv("Python developer with 3 years of experience.")

    expect(result.experienceYears).toBe(3)
    expect(result.jobTitles).toEqual(["Developer"])
    expect(result.workPreferences).toEqual(["remote"])
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe("http://127.0.0.1:8010/parse-cv")
    expect(init?.headers).toMatchObject({ "x-job-matcher-internal-token": TOKEN })
    expect(JSON.parse(String(init?.body))).toEqual({ cv_text: "Python developer with 3 years of experience." })
  })

  it("sends trusted job snapshots with snake_case keys and maps ranked results", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(matchPayload))
    const result = await client().matchJobs(profile, [job], 10)

    expect(result.results[0].jobId).toBe("job-1")
    expect(result.results[0].compatibilityScore).toBe(84)
    expect(result.results[0].scoreBreakdown.applicableWeightTotal).toBe(1)
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>
    const jobs = body.jobs as Array<Record<string, unknown>>
    expect(jobs[0].job_id).toBe("job-1")
    expect(jobs[0].required_skills).toEqual(["Python"])
    expect((body.options as Record<string, unknown>).top_n).toBe(10)
  })

  it("fails closed when no internal token is configured", async () => {
    const fetchMock = jest.spyOn(global, "fetch")
    await expect(client({ JOB_MATCHER_INTERNAL_TOKEN: "" }).parseCv("text")).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps HTTP 503 and 429 to an unavailable service", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ detail: "down" }, 503))
    await expect(client().parseCv("text")).rejects.toBeInstanceOf(ServiceUnavailableException)
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ detail: "slow down" }, 429))
    await expect(client().parseCv("text")).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it("maps HTTP 400 to a bad request without echoing internals", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ detail: "Le PDF est vide." }, 400))
    await expect(client().parseCv("text")).rejects.toMatchObject({ message: "Le PDF est vide." })
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({}, 400))
    await expect(client().parseCv("text")).rejects.toBeInstanceOf(BadRequestException)
  })

  it("maps a provider timeout to a gateway timeout without leaking the token", async () => {
    const timeout = Object.assign(new Error("aborted"), { name: "TimeoutError" })
    jest.spyOn(global, "fetch").mockRejectedValue(timeout)
    const error = await client().parseCv("text").catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(GatewayTimeoutException)
    expect((error as Error).message).not.toContain(TOKEN)
  })

  it("maps a network failure to unavailable", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new TypeError("fetch failed"))
    await expect(client().parseCv("text")).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it("rejects a malformed match response instead of fabricating results", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ results: "nope" }))
    await expect(client().matchJobs(profile, [job], 10)).rejects.toBeInstanceOf(BadGatewayException)
  })

  it("rejects out-of-range or non-numeric compatibility scores", async () => {
    const payload = structuredClone(matchPayload)
    payload.results[0].compatibility_score = 140
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(payload))
    await expect(client().matchJobs(profile, [job], 10)).rejects.toBeInstanceOf(BadGatewayException)

    const missing = structuredClone(matchPayload) as Record<string, unknown>
    missing.results = [{ job_id: "job-1", job_title: "Dev" }]
    jest.spyOn(global, "fetch").mockResolvedValue(jsonResponse(missing))
    await expect(client().matchJobs(profile, [job], 10)).rejects.toBeInstanceOf(BadGatewayException)
  })
})
