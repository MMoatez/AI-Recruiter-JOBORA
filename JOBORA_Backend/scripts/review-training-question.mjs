import mongoose from "mongoose"

const [questionId, decision, reviewer] = process.argv.slice(2)
if (!questionId || !["approved", "rejected"].includes(decision) || !reviewer) {
  console.error("Usage: npm run training:review -- <question-id> <approved|rejected> <reviewer-reference>")
  process.exit(2)
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required")
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
try {
  const collection = mongoose.connection.collection("training_assessment_questions")
  const current = await collection.findOne({ id: questionId, source: "groq" })
  if (!current) throw new Error("Groq-generated question not found")
  if (current.reviewStatus !== "pending_review") throw new Error("Only pending_review questions can be decided")
  const result = await collection.updateOne({ id: questionId, reviewStatus: "pending_review" }, { $set: {
    reviewStatus: decision, reviewDecision: decision, reviewedBy: reviewer, reviewedAt: new Date(),
    questionBankVersion: Number(current.questionBankVersion || 1) + 1,
  } })
  if (result.modifiedCount !== 1) throw new Error("Question review raced with another decision")
  console.log(`${questionId}: ${decision} by ${reviewer}`)
} finally { await mongoose.disconnect() }
