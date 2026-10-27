import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { DatabaseService } from "../database/database.service"
import { TrainingService } from "./training.service"

describe("TrainingService with SQLite", () => {
  let database: DatabaseService
  let service: TrainingService
  beforeEach(() => {
    process.env.SQLITE_PATH = ":memory:"
    database = new DatabaseService()
    service = new TrainingService(database, new ConfigService({ TRAINING_AI_INTERNAL_TOKEN: "test-token" }))
  })
  afterEach(() => { jest.restoreAllMocks(); database.onModuleDestroy() })

  it("scopes plan reads to the authenticated account", async () => {
    await expect(service.getPlan("user-a", "plan-missing")).rejects.toBeInstanceOf(NotFoundException)
  })

  it("stores and returns training plans and progress in SQLite", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({
      roadmap: { title: "Career plan" }, provenance: { model: "test-model" },
      gaps: [], resources: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } }))
    const analyzed = await service.analyze("user-a", {
      candidate_skills: [{ name: "React", level: "beginner", evidence: [] }],
      job_description: "A sufficiently detailed job description for a React engineer.",
      career_goal: "Become a React engineer", current_level: "beginner", weekly_hours: 4,
      target_weeks: 4, preferred_language: "en", free_only: true,
    } as never)
    expect((await service.getPlan("user-a", analyzed.plan_id)).title).toBe("Career plan")
    expect(await service.updateProgress("user-a", analyzed.plan_id, "task-1", {
      status: "completed", completion_percent: 100, minutes_spent: 30, evidence_note: null,
    } as never)).toMatchObject({ task_id: "task-1", status: "completed" })
  })

  it("refuses unreviewed assessment questions before scoring", async () => {
    const sessionId = "session-1"
    database.collection("training_sessions").create({
      id: sessionId, userId: "user-a", status: "active", skill: "React", questionIds: ["q1"], answers: [],
    })
    database.collection("training_questions").create({
      id: "q1", conceptId: "react:hooks", skill: "React", prompt: "Question?", choices: ["A", "B"],
      correctChoice: 0, explanation: "Explanation", difficulty: "beginner", reviewStatus: "pending_review", source: "groq",
    })
    await expect(service.submitAssessment("user-a", sessionId, {
      answers: [{ question_id: "q1", selected_choice: 0 }],
    } as never)).rejects.toBeInstanceOf(ForbiddenException)
  })
})
