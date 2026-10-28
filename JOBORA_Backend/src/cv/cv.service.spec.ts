import { NotFoundException } from "@nestjs/common"
import { DatabaseService } from "../database/database.service"
import { CvService } from "./cv.service"

const sampleCv = (id = "cv_1", userId = "user_1") => ({
  id, userId, title: "CV", targetJob: "Developer", careerObjective: "Find a developer role",
  personalInformation: { firstName: "Lina", email: "lina@example.com", phone: "+21600000000" },
  professionalSummary: "Experienced developer", education: [],
  experiences: [{ company: "Source Company", bulletPoints: [], rawDescription: "API" }],
  projects: [{ name: "One", description: "Before", technologies: [] }],
  technicalSkills: ["Node.js"], softSkills: [], tools: [], languages: [], certifications: [],
  atsValidation: null, ragMetadata: null, generatedContent: null, promptVersion: "V1", status: "draft",
})

describe("CvService with SQLite", () => {
  let database: DatabaseService
  let service: CvService
  const gemini = { generate: jest.fn(), validateAts: jest.fn(), regenerateSection: jest.fn() }
  const ats = { validate: jest.fn(), merge: jest.fn() }

  beforeEach(async () => {
    process.env.SQLITE_PATH = ":memory:"
    database = new DatabaseService()
    service = new CvService(database, gemini as never, ats as never)
    jest.clearAllMocks()
    await service.create("user_1", sampleCv() as never)
  })

  afterEach(() => database.onModuleDestroy())

  it("reads only a CV owned by the authenticated user", async () => {
    await expect(service.get("user_1", "cv_1")).resolves.toMatchObject({ id: "cv_1", userId: "user_1" })
    await expect(service.get("user_2", "cv_1")).rejects.toBeInstanceOf(NotFoundException)
  })

  it("creates, updates, lists, and deletes CVs in SQLite", async () => {
    await service.update("user_1", "cv_1", { ...sampleCv(), title: "Updated CV" } as never)
    expect((await service.list("user_1"))[0]).toMatchObject({ title: "Updated CV" })
    expect(await service.remove("user_1", "cv_1")).toEqual({ deleted: true })
    await expect(service.get("user_1", "cv_1")).rejects.toBeInstanceOf(NotFoundException)
  })

  it("preserves source facts and rejects generated skills that were not supplied", () => {
    const merge = (service as unknown as { mergeGeneratedContent: (candidate: Record<string, unknown>, generated: Record<string, unknown>) => Record<string, unknown> }).mergeGeneratedContent.bind(service)
    const result = merge(sampleCv(), { professionalSummary: "Developer", education: [], experiences: [{ company: "Invented", bulletPoints: ["Built APIs"] }], projects: [], technicalSkills: ["Node.js", "Kubernetes"] }) as { experiences: Array<{ company: string }>; technicalSkills: string[] }
    expect(result.experiences[0].company).toBe("Source Company")
    expect(result.technicalSkills).toEqual(["Node.js"])
  })

<<<<<<< HEAD
  it("removes account identity and personal contact details before Gemini validation", async () => {
    ats.validate.mockReturnValue({ status: "PASS", score: 100 })
    ats.merge.mockReturnValue({ status: "PASS", score: 95 })
    gemini.validateAts.mockResolvedValue({ status: "PASS", score: 90 })
=======
  it("matches generated entries by stable id when Gemini changes their order", () => {
    const service = new CvService({} as never, {} as never, {} as never)
    const merge = (service as unknown as { mergeGeneratedContent: (candidate: Record<string, unknown>, generated: Record<string, unknown>) => Record<string, unknown> }).mergeGeneratedContent.bind(service)
    const result = merge(
      {
        education: [], projects: [], technicalSkills: [], softSkills: [], languages: [], certifications: [],
        experiences: [
          { id: "exp-1", company: "One", bulletPoints: [] },
          { id: "exp-2", company: "Two", bulletPoints: [] },
        ],
      },
      {
        professionalSummary: "Profil", education: [], projects: [], technicalSkills: [],
        experiences: [
          { id: "exp-2", bulletPoints: ["Second"] },
          { id: "exp-1", bulletPoints: ["First"] },
        ],
      },
    ) as { experiences: Array<{ bulletPoints: string[] }> }

    expect(result.experiences.map((experience) => experience.bulletPoints)).toEqual([["First"], ["Second"]])
  })

  it("never sends raw personal information or database metadata to Gemini", () => {
    const service = new CvService({} as never, {} as never, {} as never)
    const sanitize = (service as unknown as { toSafeCandidate: (cv: Record<string, unknown>) => Record<string, unknown> }).toSafeCandidate.bind(service)
    const candidate = sanitize({
      _id: "mongo-id", __v: 0, userId: "user_1",
      personalInformation: { firstName: "Lina", email: "lina@example.com", phone: "+21600000000" },
      title: "CV", targetJob: "Developer", technicalSkills: ["Node.js"],
    })
    expect(candidate).not.toHaveProperty("_id")
    expect(candidate).not.toHaveProperty("__v")
    expect(candidate).not.toHaveProperty("userId")
    expect(candidate).not.toHaveProperty("personalInformation")
    expect(candidate).toMatchObject({ title: "CV", targetJob: "Developer", technicalSkills: ["Node.js"] })
  })

  it("sanitizes the CV before standalone Gemini ATS validation", async () => {
    const current = {
      id: "cv_1",
      userId: "user_1",
      personalInformation: { firstName: "Lina", email: "lina@example.com" },
      targetJob: "Developer",
      technicalSkills: ["Node.js"],
    }
    const model = { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(current) }) }
    const gemini = { validateAts: jest.fn().mockResolvedValue({ status: "PASS", score: 90 }) }
    const ats = {
      validate: jest.fn().mockReturnValue({ status: "PASS", score: 100 }),
      merge: jest.fn().mockReturnValue({ status: "PASS", score: 95 }),
    }
    const service = new CvService(model as never, gemini as never, ats as never)

>>>>>>> origin/matching
    await service.validate("user_1", "cv_1")
    const sent = gemini.validateAts.mock.calls[0][0] as Record<string, unknown>
    expect(sent).not.toHaveProperty("personalInformation")
    expect(sent).not.toHaveProperty("userId")
  })

<<<<<<< HEAD
  it("persists generated ATS content and retains the original CV fields", async () => {
    gemini.generate.mockResolvedValue({ content: { professionalSummary: "Generated summary", education: [], experiences: [], projects: [], technicalSkills: ["Node.js"], softSkills: [], languages: [], certifications: [] }, ragContext: "ATS context", ragMetadata: { retrievedChunkIds: ["c1"] } })
    gemini.validateAts.mockResolvedValue({ status: "PASS", score: 90 })
    ats.validate.mockReturnValue({ status: "PASS", score: 100 })
    ats.merge.mockReturnValue({ status: "PASS", score: 97 })
    const result = await service.generate("user_1", "cv_1")
    expect(result).toMatchObject({ id: "cv_1", professionalSummary: "Generated summary", status: "generated", ragMetadata: { retrievedChunkIds: ["c1"] } })
    expect(result.experiences[0].company).toBe("Source Company")
=======
  it("orchestrates RAG-backed generation and stores explainability metadata", async () => {
    const current = { id: "cv_1", userId: "user_1", targetJob: "Developer", education: [], experiences: [], projects: [], technicalSkills: ["Node.js"], softSkills: [], languages: [], certifications: [] }
    const findOneAndUpdate = jest.fn().mockImplementation((_filter, update) => update.$set)
    const model = { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(current) }), findOneAndUpdate }
    const gemini = {
      generate: jest.fn().mockResolvedValue({ content: { professionalSummary: "Node.js developer.", education: [], experiences: [], projects: [], technicalSkills: ["Node.js"], softSkills: [], languages: [], certifications: [] }, ragContext: "ATS context", ragMetadata: { retrievedChunkIds: ["c1"] } }),
      validateAts: jest.fn().mockResolvedValue({ status: "PASS", score: 90, checks: {}, issues: [], suggestions: [] }),
    }
    const ats = { validate: jest.fn().mockReturnValue({ status: "PASS", score: 100, checks: { standardSections: true }, issues: [], suggestions: [] }), merge: jest.fn().mockReturnValue({ status: "PASS", score: 97 }) }
    const service = new CvService(model as never, gemini as never, ats as never)
    const result = await service.generate("user_1", "cv_1") as unknown as { promptVersion: string; ragMetadata: { retrievedChunkIds: string[] } }
    expect(result.promptVersion).toBe("CV_GENERATE_001_V7")
    expect(result.ragMetadata.retrievedChunkIds).toEqual(["c1"])
    expect(gemini.validateAts).toHaveBeenCalledWith(expect.any(Object), "ATS context")
  })

  it("regenerates only the requested project description", async () => {
    const current = { _id: "mongo-id", __v: 0, id: "cv_1", userId: "user_1", targetJob: "Developer", professionalSummary: "Profile", education: [], experiences: [], projects: [{ name: "One", description: "Before" }, { name: "Two", description: "Keep" }], technicalSkills: ["Node.js"] }
    const findOneAndUpdate = jest.fn().mockImplementation((_filter, update) => update.$set)
    const model = { findOne: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(current) }), findOneAndUpdate }
    const gemini = { regenerateSection: jest.fn().mockResolvedValue({ content: "After", ragMetadata: { retrievedChunkIds: ["p1"] } }) }
    const ats = { validate: jest.fn().mockReturnValue({ status: "PASS" }) }
    const service = new CvService(model as never, gemini as never, ats as never)
    const result = await service.regenerateSection("user_1", "cv_1", { section: "project", index: 0 }) as unknown as { projects: Array<{ description: string }> }
    expect(result.projects.map((project) => project.description)).toEqual(["After", "Keep"])
    expect(findOneAndUpdate.mock.calls[0][1].$set).not.toHaveProperty("_id")
    expect(findOneAndUpdate.mock.calls[0][1].$set).not.toHaveProperty("__v")
    expect(findOneAndUpdate.mock.calls[0][1].$set).not.toHaveProperty("userId")
>>>>>>> origin/matching
  })
})
