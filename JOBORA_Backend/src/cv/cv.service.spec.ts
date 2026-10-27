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

  it("removes account identity and personal contact details before Gemini validation", async () => {
    ats.validate.mockReturnValue({ status: "PASS", score: 100 })
    ats.merge.mockReturnValue({ status: "PASS", score: 95 })
    gemini.validateAts.mockResolvedValue({ status: "PASS", score: 90 })
    await service.validate("user_1", "cv_1")
    const sent = gemini.validateAts.mock.calls[0][0] as Record<string, unknown>
    expect(sent).not.toHaveProperty("personalInformation")
    expect(sent).not.toHaveProperty("userId")
  })

  it("persists generated ATS content and retains the original CV fields", async () => {
    gemini.generate.mockResolvedValue({ content: { professionalSummary: "Generated summary", education: [], experiences: [], projects: [], technicalSkills: ["Node.js"], softSkills: [], languages: [], certifications: [] }, ragContext: "ATS context", ragMetadata: { retrievedChunkIds: ["c1"] } })
    gemini.validateAts.mockResolvedValue({ status: "PASS", score: 90 })
    ats.validate.mockReturnValue({ status: "PASS", score: 100 })
    ats.merge.mockReturnValue({ status: "PASS", score: 97 })
    const result = await service.generate("user_1", "cv_1")
    expect(result).toMatchObject({ id: "cv_1", professionalSummary: "Generated summary", status: "generated", ragMetadata: { retrievedChunkIds: ["c1"] } })
    expect(result.experiences[0].company).toBe("Source Company")
  })
})
