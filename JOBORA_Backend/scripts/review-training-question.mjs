import Database from "better-sqlite3"
import { resolve } from "node:path"

const [questionId, decision, reviewer] = process.argv.slice(2)
if (!questionId || !["approved", "rejected"].includes(decision) || !reviewer) {
  console.error("Usage: npm run training:review -- <question-id> <approved|rejected> <reviewer-reference>")
  process.exit(2)
}
const dbPath = resolve(process.env.SQLITE_PATH || "data/jobora.sqlite")
const database = new Database(dbPath)
try {
  const currentRow = database.prepare("SELECT payload FROM training_questions WHERE id = ?").get(questionId)
  const current = currentRow ? JSON.parse(currentRow.payload) : null
  if (current?.source !== "groq") throw new Error("Groq-generated question not found")
  if (current.reviewStatus !== "pending_review") throw new Error("Only pending_review questions can be decided")
  const next = {
    ...current,
    reviewStatus: decision, reviewDecision: decision, reviewedBy: reviewer, reviewedAt: new Date(),
    questionBankVersion: Number(current.questionBankVersion || 1) + 1,
    updatedAt: new Date().toISOString(),
  }
  const result = database.prepare("UPDATE training_questions SET payload = ?, updated_at = ? WHERE id = ? AND json_extract(payload, '$.reviewStatus') = 'pending_review'")
    .run(JSON.stringify(next), next.updatedAt, questionId)
  if (result.changes !== 1) throw new Error("Question review raced with another decision")
  console.log(`${questionId}: ${decision} by ${reviewer}`)
} finally { database.close() }
