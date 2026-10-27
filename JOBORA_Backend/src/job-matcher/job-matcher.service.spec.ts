import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import type { JobMatcherAiClient } from "./job-matcher-ai.client"
import type { CandidateProfile, MatchResponsePayload } from "./job-matcher.types"
import { JobMatcherService } from "./job-matcher.service"

const OWNER = "user-a"
const OTHER = "user-b"

const profile: CandidateProfile = {
  skills: ["TypeScript", "Node.js", "PostgreSQL"],
  experienceYears: 3,
  seniority: "junior",
  jobTitles: ["Backend Developer"],
  languages: ["French", "English"],
  education: ["Software Engineering"],
  certifications: [],
  preferredLocations: ["Paris"],
  workPreferences: [],
}

const cv = {
  id: "cv-owned",
  userId: OWNER,
  title: "CV backend",
  targetJob: "Backend Developer",
  careerObjective: "Build reliable APIs",
  professionalSummary: "Developer with three years of experience",
  personalInformation: { email: "private@example.com", phone: "+33 6 12 34 56 78" },
  education: [],
  experiences: [],
  projects: [],
  technicalSkills: ["TypeScript", "Node.js"],
  tools: ["Git"],
  softSkills: [],
  languages: ["French"],
  certifications: [],
  rawText: "Backend developer working with TypeScript, Node.js and PostgreSQL.",
}

const matchPayload: MatchResponsePayload = {
  results: [
    {
      jobId: "demo-backend-node",
      jobTitle: "Développeur Backend Node.js (démo)",
      company: "Atelier Démo",
      location: "Paris, France",
      workArrangement: "hybrid",
      compatibilityScore: 84,
      matchedSkills: ["TypeScript", "Node.js", "PostgreSQL"],
      missingRequiredSkills: ["REST"],
      missingPreferredSkills: ["Docker"],
      semanticFit: 0.9,
      reasons: ["Ton expérience TypeScript correspond au poste."],
      recommendations: ["Ajoute une expérience REST à ton CV."],
      gaps: ["REST"],
      scoreBreakdown: {
        requiredSkills: 0.75,
        preferredSkills: 0,
        experience: 1,
        seniority: 1,
        semanticFit: 0.9,
        applicableWeightTotal: 1,
      },
    },
  ],
  totalJobsAnalyzed: 1,
  totalJobsEligible: 1,
  excludedJobs: [],
  weights: { required_skills: 0.4, semantic_fit: 0.15 },
  algorithm: "hybrid",
}

type AiStub = { parseCv: jest.Mock; matchJobs: jest.Mock }

function aiStub(): AiStub {
  return { parseCv: jest.fn(), matchJobs: jest.fn() }
}

describe("JobMatcherService", () => {
  let database: DatabaseService
  let ai: AiStub
  let service: JobMatcherService

  beforeEach(() => {
    process.env.SQLITE_PATH = ":memory:"
    database = new DatabaseService()
    const now = database.now()
    database.connection
      .prepare("INSERT INTO cvs(id,user_id,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)")
      .run(cv.id, cv.userId, cv.title, JSON.stringify({ ...cv, createdAt: now, updatedAt: now }), now, now)
    ai = aiStub()
    service = new JobMatcherService(database, ai as unknown as JobMatcherAiClient)
  })

  afterEach(() => {
    jest.restoreAllMocks()
    database.onModuleDestroy()
  })

  async function seedProfile() {
    ai.parseCv.mockResolvedValue(profile)
    return service.buildProfile(OWNER, cv.id)
  }

  describe("candidate profile", () => {
    it("extracts a profile from the owned CV and persists the correction", async () => {
      ai.parseCv.mockResolvedValue(profile)
      const created = await service.buildProfile(OWNER, cv.id)

      expect(created.profile.skills).toContain("TypeScript")
      expect(ai.parseCv.mock.calls[0][0]).toContain("TypeScript")
      expect(ai.parseCv.mock.calls[0][0]).toContain("PostgreSQL")

      const loaded = await service.getProfile(OWNER, cv.id)
      expect(loaded.profile.experienceYears).toBe(3)

      const saved = await service.saveProfile(OWNER, cv.id, {
        ...profile,
        skills: ["TypeScript", "Node.js", "Docker"],
        experienceYears: 4,
      })
      expect(saved.profile.skills).toContain("Docker")
      expect((await service.getProfile(OWNER, cv.id)).profile.experienceYears).toBe(4)
    })

    it("does not expose another account's CV or profile", async () => {
      await seedProfile()
      await expect(service.buildProfile(OTHER, cv.id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.getProfile(OTHER, cv.id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.saveProfile(OTHER, cv.id, profile)).rejects.toBeInstanceOf(NotFoundException)
    })

    it("returns 404 until a profile has been extracted", async () => {
      await expect(service.getProfile(OWNER, cv.id)).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe("job catalogue", () => {
    it("lists labeled demo jobs plus only the caller's own jobs", async () => {
      const mine = await service.createJob(OWNER, {
        title: "Développeur Full-Stack",
        company: "Ma société",
        description: "Une description suffisamment longue pour être validée.",
      })
      const theirs = await service.createJob(OTHER, {
        title: "Offre privée",
        company: "Autre",
        description: "Une description suffisamment longue pour être validée.",
      })

      const jobs = await service.listJobs(OWNER)
      const demo = jobs.filter((job) => job.isDemo)
      expect(demo.length).toBeGreaterThan(0)
      expect(demo.every((job) => job.id.startsWith("demo-"))).toBe(true)
      expect(jobs.some((job) => job.id === mine.id && !job.isDemo)).toBe(true)
      expect(jobs.some((job) => job.id === theirs.id)).toBe(false)
    })
  })

  describe("matching sessions", () => {
    it("requires an extracted profile before matching", async () => {
      await expect(service.createMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"] }))
        .rejects.toBeInstanceOf(BadRequestException)
    })

    it("accepts a corrected profile and snapshots the selected jobs", async () => {
      const session = await service.createMatch(OWNER, {
        cvId: cv.id,
        jobIds: ["demo-backend-node"],
        profile,
        topN: 5,
      })
      expect(session.status).toBe("pending")
      expect(session.jobs).toHaveLength(1)
      expect(session.jobs[0].title).toContain("démo")
      expect((await service.getStatus(OWNER, session.id)).status).toBe("pending")
    })

    it("rejects a job owned by another account", async () => {
      const theirs = await service.createJob(OTHER, {
        title: "Offre privée",
        description: "Une description suffisamment longue pour être validée.",
      })
      await expect(service.createMatch(OWNER, { cvId: cv.id, jobIds: [theirs.id], profile }))
        .rejects.toBeInstanceOf(NotFoundException)
    })

    it("completes a session, exposes results and history, then deletes only the owner's record", async () => {
      const session = await service.createMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"], profile })
      ai.matchJobs.mockResolvedValue(matchPayload)

      const completed = await service.runMatching(session.id, OWNER)
      expect(completed?.status).toBe("completed")

      const status = await service.getStatus(OWNER, session.id)
      expect(status.status).toBe("completed")
      expect(status.completedAt).toBeTruthy()

      const results = await service.getResults(OWNER, session.id)
      expect(results.results[0].compatibilityScore).toBe(84)
      expect(results.algorithm).toBe("hybrid")

      const history = await service.getHistory(OWNER)
      expect(history[0].id).toBe(session.id)
      expect(history[0].topScore).toBe(84)

      expect(await service.getHistory(OTHER)).toEqual([])
      await expect(service.getStatus(OTHER, session.id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.getResults(OTHER, session.id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.deleteHistory(OTHER, session.id)).rejects.toBeInstanceOf(NotFoundException)

      expect(await service.deleteHistory(OWNER, session.id)).toEqual({ deleted: true })
      expect(await service.getHistory(OWNER)).toEqual([])
    })

    it("exposes the processing state while the provider is working", async () => {
      const session = await service.createMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"], profile })
      let release: ((value: MatchResponsePayload) => void) | undefined
      ai.matchJobs.mockImplementation(() => new Promise<MatchResponsePayload>((resolve) => { release = resolve }))

      const running = service.runMatching(session.id, OWNER)
      await new Promise((resolve) => setImmediate(resolve))
      expect((await service.getStatus(OWNER, session.id)).status).toBe("processing")

      release?.(matchPayload)
      expect((await running)?.status).toBe("completed")
    })

    it("does not call the provider twice for an already processed session", async () => {
      const session = await service.createMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"], profile })
      ai.matchJobs.mockResolvedValue(matchPayload)
      await service.runMatching(session.id, OWNER)
      await service.runMatching(session.id, OWNER)
      expect(ai.matchJobs).toHaveBeenCalledTimes(1)
    })

    it("marks the session failed and returns no results when the provider is unavailable", async () => {
      const session = await service.createMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"], profile })
      ai.matchJobs.mockRejectedValue(new ServiceUnavailableException("Le service de matching est temporairement indisponible."))

      const failed = await service.runMatching(session.id, OWNER)
      expect(failed?.status).toBe("failed")
      expect(failed?.error).toContain("indisponible")
      expect(failed?.results).toBeUndefined()

      await expect(service.getResults(OWNER, session.id)).rejects.toBeInstanceOf(ConflictException)
      const history = await service.getHistory(OWNER)
      expect(history[0].status).toBe("failed")
      expect(history[0].topScore).toBeNull()
    })

    it("never persists raw internal error text", async () => {
      const session = await service.createMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"], profile })
      ai.matchJobs.mockRejectedValue(new Error("secret stack trace with CV content"))

      const failed = await service.runMatching(session.id, OWNER)
      expect(failed?.error).not.toContain("secret")
      expect(failed?.error).not.toContain("CV content")
    })

    it("processes a started session asynchronously", async () => {
      ai.parseCv.mockResolvedValue(profile)
      await service.buildProfile(OWNER, cv.id)
      ai.matchJobs.mockResolvedValue(matchPayload)

      const started = await service.startMatch(OWNER, { cvId: cv.id, jobIds: ["demo-backend-node"] })
      expect(started.status).toBe("pending")

      let status = "pending"
      for (let attempt = 0; attempt < 50 && status !== "completed"; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 10))
        status = (await service.getStatus(OWNER, started.id)).status
      }
      expect(status).toBe("completed")
    })
  })
})
