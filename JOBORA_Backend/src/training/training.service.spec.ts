import { ForbiddenException, NotFoundException } from "@nestjs/common"
import { TrainingService } from "./training.service"

const chain = (value: unknown) => ({ lean: () => ({ exec: async () => value }), exec: async () => value })

function service(overrides: Record<string, any> = {}) {
  const plans = { findOne: jest.fn(() => chain(null)), exists: jest.fn(), create: jest.fn(), ...overrides.plans }
  const progress = { find: jest.fn(() => chain([])), findOneAndUpdate: jest.fn(), ...overrides.progress }
  const questions = { find: jest.fn(), bulkWrite: jest.fn(), ...overrides.questions }
  const sessions = { findOneAndUpdate: jest.fn(), findOne: jest.fn(), updateOne: jest.fn(() => ({ exec: async () => ({}) })), create: jest.fn(), ...overrides.sessions }
  const mastery = { find: jest.fn(), findOne: jest.fn(), create: jest.fn(), deleteMany: jest.fn(() => ({ exec: async () => ({}) })), ...overrides.mastery }
  const config = { get: jest.fn((key: string, fallback: string) => key === "TRAINING_AI_INTERNAL_TOKEN" ? "test-token" : fallback) }
  return { instance: new TrainingService(plans as never, progress as never, questions as never, sessions as never, mastery as never, config as never), plans, progress, questions, sessions, mastery }
}

describe("TrainingService ownership and assessment integrity", () => {
  it("always scopes plan reads to the JWT user", async () => {
    const context = service()
    await expect(context.instance.getPlan("user-a", "plan-1")).rejects.toBeInstanceOf(NotFoundException)
    expect(context.plans.findOne).toHaveBeenCalledWith({ id: "plan-1", userId: "user-a" })
  })

  it("rejects unapproved session questions before mastery writes and resets processing", async () => {
    const context = service({
      sessions: { findOneAndUpdate: jest.fn(() => ({ exec: async () => ({ id: "s1", userId: "user-a", status: "processing", questionIds: ["q1"] }) })) },
      questions: { find: jest.fn(() => chain([{ id: "q1", reviewStatus: "pending_review" }])) },
    })
    await expect(context.instance.submitAssessment("user-a", "s1", { answers: [{ question_id: "q1", selected_choice: 0 }] })).rejects.toBeInstanceOf(ForbiddenException)
    expect(context.mastery.create).not.toHaveBeenCalled()
    expect(context.mastery.deleteMany).toHaveBeenCalledWith({ userId: "user-a", sessionId: "s1" })
    expect(context.sessions.updateOne).toHaveBeenCalledWith({ id: "s1", userId: "user-a", status: "processing" }, { $set: { status: "active", answers: [] } })
  })
})
