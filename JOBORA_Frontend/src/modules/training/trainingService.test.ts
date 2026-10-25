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
Object.defineProperty(globalThis, "window", { value: { location: { replace() {} } }, configurable: true })

const { trainingService } = await import("./trainingService.ts")

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem("ai-recruiter.session", JSON.stringify({
    accessToken: "header.payload.signature",
    user: { id: "user_from_jwt", name: "Test", email: "test@example.invalid" },
  }))
})

test("Training calls the JOBORA NestJS API with the existing JWT", async () => {
  let url = ""
  let authorization = ""
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (input: string, init?: RequestInit) => {
    url = input
    authorization = new Headers(init?.headers).get("Authorization") ?? ""
    return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } })
  } })

  await trainingService.mastery()

  assert.equal(url, "http://localhost:3000/api/training/mastery")
  assert.equal(authorization, "Bearer header.payload.signature")
})

test("Training analysis does not send a client-selected owner", async () => {
  let body: Record<string, unknown> = {}
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: async (_input: string, init?: RequestInit) => {
    body = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({}), { status: 200, headers: { "Content-Type": "application/json" } })
  } })

  await trainingService.analyze({
    candidate_skills: [], job_description: "A sufficiently long job description",
    career_goal: "Engineer", current_level: "beginner", weekly_hours: 4,
    target_weeks: 4, preferred_language: "en", free_only: true,
  })

  assert.equal("user_reference" in body, false)
  assert.equal("userId" in body, false)
})
