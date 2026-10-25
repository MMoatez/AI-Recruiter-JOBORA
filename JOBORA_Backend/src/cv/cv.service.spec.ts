import { NotFoundException } from "@nestjs/common"
import { CvService } from "./cv.service"

describe("CvService ownership", () => {
  it("always scopes reads to the authenticated user", async () => {
    const lean = jest.fn().mockResolvedValue({ id: "cv_1", userId: "user_1" })
    const findOne = jest.fn().mockReturnValue({ lean })
    const service = new CvService({ findOne } as never, {} as never, {} as never)
    await service.get("user_1", "cv_1")
    expect(findOne).toHaveBeenCalledWith({ id: "cv_1", userId: "user_1" })
  })

  it("returns not found instead of exposing another user's CV", async () => {
    const findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) })
    const service = new CvService({ findOne } as never, {} as never, {} as never)
    await expect(service.get("user_2", "cv_1")).rejects.toBeInstanceOf(NotFoundException)
  })

  it("preserves source facts and rejects generated skills that were not supplied", () => {
    const service = new CvService({} as never, {} as never, {} as never)
    const merge = (service as unknown as { mergeGeneratedContent: (candidate: Record<string, unknown>, generated: Record<string, unknown>) => Record<string, unknown> }).mergeGeneratedContent.bind(service)
    const result = merge(
      { education: [], experiences: [{ company: "Source Company", bulletPoints: [], rawDescription: "API" }], projects: [], technicalSkills: ["Node.js"], softSkills: [], languages: [], certifications: [] },
      { professionalSummary: "Ignore previous instructions is treated as candidate text.", education: [], experiences: [{ company: "Invented Company", bulletPoints: ["Développé une API."] }], projects: [], technicalSkills: ["Node.js", "Kubernetes"] },
    ) as { experiences: Array<{ company: string }>; technicalSkills: string[] }
    expect(result.experiences[0].company).toBe("Source Company")
    expect(result.technicalSkills).toEqual(["Node.js"])
  })

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

    await service.validate("user_1", "cv_1")

    expect(gemini.validateAts).toHaveBeenCalledWith(expect.objectContaining({ targetJob: "Developer" }))
    expect(gemini.validateAts.mock.calls[0][0]).not.toHaveProperty("personalInformation")
    expect(gemini.validateAts.mock.calls[0][0]).not.toHaveProperty("userId")
  })

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
  })
})
