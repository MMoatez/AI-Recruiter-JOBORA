import { NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DatabaseService } from "../database/database.service"
import { MatchingService } from "./matching.service"

const cv = {
  id: "cv-owned", userId: "user-a", title: "CV", targetJob: "Developer",
  personalInformation: { firstName: "Private Name", email: "private@example.com" },
  careerObjective: "Find a software role", professionalSummary: "Software engineer with experience",
  education: [], experiences: [], projects: [], technicalSkills: ["TypeScript"], tools: ["Git"],
  softSkills: [], languages: [], certifications: [], rawText: "Extracted CV text with sufficient readable content.",
}

describe("MatchingService using SQLite and internal SBERT", () => {
  let database: DatabaseService
  let service: MatchingService

  beforeEach(async () => {
    process.env.SQLITE_PATH = ":memory:"
    database = new DatabaseService()
    const now = database.now()
    database.connection.prepare("INSERT INTO cvs(id,user_id,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)")
      .run(cv.id, cv.userId, cv.title, JSON.stringify({ ...cv, createdAt: now, updatedAt: now }), now, now)
    service = new MatchingService(database, new ConfigService({ CV_MATCHING_INTERNAL_TOKEN: "internal-test-token" }))
  })

  afterEach(() => { jest.restoreAllMocks(); database.onModuleDestroy() })

  it("scopes CV lookup to the authenticated account and sends sanitized text to SBERT", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      compatibility_score: 81.25,
      top_job_matches: [{ title: "Software Engineer", score: 95.5 }],
      algorithm: "SBERT cosine similarity",
    }), { status: 200, headers: { "Content-Type": "application/json" } }))

    const result = await service.analyze("user-a", { cvId: "cv-owned", jobDescription: "A sufficiently detailed description of a software engineering role." })

    expect(result.compatibility_score).toBe(81.25)
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { resume_text: string }
    expect(sent.resume_text).toContain("TypeScript")
    expect(sent.resume_text).toContain("Extracted CV text")
    expect(sent.resume_text).not.toContain("Private Name")
    expect(sent.resume_text).not.toContain("private@example.com")
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ "x-training-internal-token": "internal-test-token" })
  })

  it("does not reveal a CV owned by another account", async () => {
    await expect(service.analyze("user-b", { cvId: "cv-owned", jobDescription: "A sufficiently detailed description of a software engineering role." }))
      .rejects.toBeInstanceOf(NotFoundException)
  })
})
