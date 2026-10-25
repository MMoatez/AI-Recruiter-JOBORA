import { BadGatewayException, BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectModel } from "@nestjs/mongoose"
import { randomUUID } from "crypto"
import { Model } from "mongoose"
import { AnalyzeTrainingDto, CreateAssessmentDto, ProgressDto, SubmitAssessmentDto } from "./dto/training.dto"
import { TrainingMastery, TrainingMasteryDocument, TrainingPlan, TrainingPlanDocument, TrainingProgress, TrainingProgressDocument, TrainingQuestion, TrainingQuestionDocument, TrainingSession, TrainingSessionDocument } from "./training.schemas"

@Injectable()
export class TrainingService {
  private readonly aiUrl: string
  private readonly aiToken: string
  private readonly aiTimeoutMs: number
  constructor(
    @InjectModel(TrainingPlan.name) private readonly plans: Model<TrainingPlanDocument>,
    @InjectModel(TrainingProgress.name) private readonly progress: Model<TrainingProgressDocument>,
    @InjectModel(TrainingQuestion.name) private readonly questions: Model<TrainingQuestionDocument>,
    @InjectModel(TrainingSession.name) private readonly sessions: Model<TrainingSessionDocument>,
    @InjectModel(TrainingMastery.name) private readonly mastery: Model<TrainingMasteryDocument>,
    config: ConfigService,
  ) {
    this.aiUrl = config.get<string>("TRAINING_AI_SERVICE_URL", "http://127.0.0.1:8002").replace(/\/$/, "")
    this.aiToken = config.get<string>("TRAINING_AI_INTERNAL_TOKEN", "")
    this.aiTimeoutMs = Number(config.get("TRAINING_AI_TIMEOUT_MS", 120000))
  }

  private async ai<T>(path: string, body?: unknown): Promise<T> {
    try {
      const response = await fetch(`${this.aiUrl}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { "content-type": "application/json", "x-training-internal-token": this.aiToken },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.aiTimeoutMs),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new BadGatewayException(payload?.detail || "Training AI service error")
      return payload as T
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      throw new ServiceUnavailableException("Le service IA de formation est indisponible.")
    }
  }

  async analyze(userId: string, dto: AnalyzeTrainingDto) {
    const generated = await this.ai<any>("/internal/training/analyze", dto)
    const id = `plan_${randomUUID().replaceAll("-", "")}`
    const plan = await this.plans.create({ id, userId, title: generated.roadmap.title, careerGoal: dto.career_goal,
      weeklyHours: dto.weekly_hours, targetWeeks: dto.target_weeks, preferredLanguage: dto.preferred_language,
      freeOnly: dto.free_only, status: "ready", provenance: "live_ai", modelName: generated.provenance.model,
      content: { gaps: generated.gaps, roadmap: generated.roadmap, resources: generated.resources } })
    return { plan_id: id, ...generated, created_at: plan.createdAt }
  }

  async getPlan(userId: string, id: string) {
    const plan = await this.plans.findOne({ id, userId }).lean().exec()
    if (!plan) throw new NotFoundException("Learning plan not found.")
    const progress = await this.progress.find({ userId, planId: id }).lean().exec()
    return { id: plan.id, user_reference: userId, title: plan.title, career_goal: plan.careerGoal,
      weekly_hours: plan.weeklyHours, target_weeks: plan.targetWeeks, preferred_language: plan.preferredLanguage,
      free_only: plan.freeOnly, status: plan.status, provenance: plan.provenance, model_name: plan.modelName || null,
      content: plan.content, progress: progress.map((p) => ({ task_id: p.taskId, status: p.status,
        completion_percent: p.completionPercent, minutes_spent: p.minutesSpent, evidence_note: p.evidenceNote ?? null,
        updated_at: p.updatedAt })), created_at: plan.createdAt, updated_at: plan.updatedAt }
  }

  async updateProgress(userId: string, planId: string, taskId: string, dto: ProgressDto) {
    if (!await this.plans.exists({ id: planId, userId })) throw new NotFoundException("Learning plan not found.")
    if ((dto.status === "completed" && dto.completion_percent !== 100) || (dto.status === "not_started" && dto.completion_percent !== 0))
      throw new BadRequestException("Task status and completion percentage disagree.")
    const saved = await this.progress.findOneAndUpdate({ userId, planId, taskId }, { $set: { status: dto.status,
      completionPercent: dto.completion_percent, minutesSpent: dto.minutes_spent, evidenceNote: dto.evidence_note ?? null } },
      { upsert: true, new: true }).lean().exec()
    return { task_id: taskId, status: saved!.status, completion_percent: saved!.completionPercent,
      minutes_spent: saved!.minutesSpent, evidence_note: saved!.evidenceNote ?? null, updated_at: saved!.updatedAt }
  }

  private async ensureCurated(skill: string) {
    const bank = await this.ai<any[]>("/internal/training/curated-questions", { skill })
    if (!bank.length) throw new NotFoundException("No reviewed question bank is available for this skill yet.")
    await this.questions.bulkWrite(bank.map((q) => ({ updateOne: { filter: { id: q.id }, update: { $setOnInsert: {
      id: q.id, conceptId: q.concept_id, skill: q.skill, prompt: q.prompt, choices: q.choices,
      correctChoice: q.correct_choice, explanation: q.explanation, difficulty: q.difficulty,
      reviewStatus: "approved", source: "curated", reviewedBy: "curated-bank-maintainers",
      reviewedAt: new Date(), reviewDecision: "approved", questionBankVersion: 1 } }, upsert: true } })))
    return this.questions.find({ id: { $in: bank.map((q) => q.id) }, reviewStatus: "approved" }).sort({ id: 1 }).lean().exec()
  }

  async createAssessment(userId: string, dto: CreateAssessmentDto) {
    if (dto.plan_id && !await this.plans.exists({ id: dto.plan_id, userId })) throw new NotFoundException("Learning plan not found.")
    const questions = await this.ensureCurated(dto.skill)
    const id = `assessment_${randomUUID().replaceAll("-", "")}`
    const session = await this.sessions.create({ id, userId, planId: dto.plan_id, skill: dto.skill,
      status: "active", questionIds: questions.map((q) => q.id), answers: [] })
    return { id, skill: dto.skill, status: "active", created_at: session.createdAt,
      questions: questions.map((q) => ({ id: q.id, concept_id: q.conceptId, prompt: q.prompt,
        choices: q.choices, difficulty: q.difficulty })) }
  }

  async submitAssessment(userId: string, sessionId: string, dto: SubmitAssessmentDto) {
    const session = await this.sessions.findOneAndUpdate({ id: sessionId, userId, status: "active" },
      { $set: { status: "processing" } }, { new: true }).exec()
    if (!session) {
      const existing = await this.sessions.findOne({ id: sessionId, userId }).lean().exec()
      if (!existing) throw new NotFoundException("Assessment not found.")
      throw new ConflictException("Assessment has already been submitted or is being processed.")
    }
    try {
      const questions = await this.questions.find({ id: { $in: session.questionIds } }).lean().exec()
      if (questions.length !== session.questionIds.length || questions.some((q) => q.reviewStatus !== "approved"))
        throw new ForbiddenException("Assessment contains an unapproved question and cannot be scored.")
      const answers = new Map(dto.answers.map((a) => [a.question_id, a.selected_choice]))
      if (answers.size !== questions.length || questions.some((q) => !answers.has(q.id)))
        throw new BadRequestException("Submit exactly one answer for every assessment question.")
      const results: any[] = []; const savedAnswers: any[] = []
      for (const question of questions) {
        const selected = answers.get(question.id)!
        if (selected >= question.choices.length) throw new BadRequestException(`Choice is out of range for ${question.id}`)
        const correct = selected === question.correctChoice
        const previous = await this.mastery.findOne({ userId, conceptId: question.conceptId }).sort({ createdAt: -1 }).lean().exec()
        const update = await this.ai<any>("/internal/training/bkt/update", { prior: previous?.nextPrior, correct })
        await this.mastery.create({ userId, conceptId: question.conceptId, skill: question.skill, sessionId,
          questionId: question.id, prior: update.prior, observationPosterior: update.observation_posterior,
          nextPrior: update.next_prior, correct, parameterVersion: update.parameter_version })
        savedAnswers.push({ questionId: question.id, selectedChoice: selected, isCorrect: correct, answeredAt: new Date() })
        results.push({ question_id: question.id, concept_id: question.conceptId, selected_choice: selected,
          correct_choice: question.correctChoice, correct, explanation: question.explanation,
          observation_posterior: update.observation_posterior, mastery: update.next_prior })
      }
      const submittedAt = new Date()
      await this.sessions.updateOne({ id: sessionId, userId, status: "processing" },
        { $set: { status: "submitted", answers: savedAnswers, submittedAt } }).exec()
      return { session_id: sessionId, score: results.filter((r) => r.correct).length,
        total: results.length, results, submitted_at: submittedAt }
    } catch (error) {
      await this.mastery.deleteMany({ userId, sessionId }).exec()
      await this.sessions.updateOne({ id: sessionId, userId, status: "processing" }, { $set: { status: "active", answers: [] } }).exec()
      throw error
    }
  }

  async history(userId: string) {
    const rows = await this.mastery.find({ userId }).sort({ createdAt: 1 }).lean().exec()
    return rows.map((r) => ({ concept_id: r.conceptId, skill: r.skill, mastery: r.nextPrior,
      observation_posterior: r.observationPosterior, correct: r.correct,
      parameter_version: r.parameterVersion, recorded_at: r.createdAt }))
  }

  async recommendations(userId: string) {
    const rows = await this.mastery.find({ userId }).sort({ createdAt: 1 }).lean().exec()
    const latest = new Map<string, typeof rows[number]>(); rows.forEach((row) => latest.set(row.conceptId, row))
    return this.ai<any[]>("/internal/training/recommendations", { concepts: [...latest.values()].map((row) => {
      let highStreak = 0
      for (const item of [...rows].reverse()) {
        if (item.conceptId !== row.conceptId) continue
        if (!item.correct) break
        highStreak += 1
      }
      return { concept_id: row.conceptId, skill: row.skill, mastery: row.nextPrior, high_streak: highStreak }
    }) })
  }
}
