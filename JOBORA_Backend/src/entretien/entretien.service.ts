import { BadGatewayException, GatewayTimeoutException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectModel } from "@nestjs/mongoose"
import { randomUUID } from "crypto"
import { Model } from "mongoose"
import { PrepSession, PrepSessionDocument } from "./entretien.schema"
import { AnswerDto, CreateSessionDto, MockInterviewDto } from "./dto/entretien.dto"

type AiQuestion = {
  skill: string
  type: string
  question: string
  options: string[]
  correct_index: number | null
  expected_answer: string
  explanation: string
  difficulty: string
  source: string | null
  verified: boolean | null
}

const unavailableMessage = "Le service IA est indisponible. Vérifie que Ollama et le service IA sont lancés."
const timeoutMessage = "La génération prend plus de temps que prévu. Réduis le nombre de questions ou réessaie."
const upstreamMessage = "Le service IA a rencontré une erreur pendant la génération."

class AiRequestError extends Error {
  constructor(
    readonly kind: "unavailable" | "timeout" | "upstream" | "invalid_response",
    readonly status?: number,
  ) {
    super(kind)
  }
}

@Injectable()
export class EntretienService {
  private readonly logger = new Logger(EntretienService.name)
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(
    @InjectModel(PrepSession.name) private readonly sessions: Model<PrepSessionDocument>,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>("AI_SERVICE_URL", "http://127.0.0.1:8000").replace(/\/$/, "")
    this.timeoutMs = Number(this.config.get<string>("AI_SERVICE_TIMEOUT_MS", "480000"))
  }

  private async callAi<T>(path: string, init: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal })
      if (!response.ok) {
        this.logger.warn(`AI service returned HTTP ${response.status}`)
        throw new AiRequestError("upstream", response.status)
      }
      try {
        return await response.json() as T
      } catch {
        throw new AiRequestError("invalid_response")
      }
    } catch (error) {
      if (error instanceof AiRequestError) throw error
      const reason = error instanceof Error ? error.name : "UnknownError"
      const kind = reason === "AbortError" ? "timeout" : reason === "TypeError" ? "unavailable" : "upstream"
      this.logger.warn(`AI service request failed: ${kind}`)
      throw new AiRequestError(kind)
    } finally {
      clearTimeout(timeout)
    }
  }

  private async callAiForRoute<T>(path: string, init: RequestInit): Promise<T> {
    try {
      return await this.callAi<T>(path, init)
    } catch (error) {
      if (!(error instanceof AiRequestError)) throw error
      if (error.kind === "timeout") throw new GatewayTimeoutException(timeoutMessage)
      if (error.kind === "unavailable") throw new ServiceUnavailableException(unavailableMessage)
      if (error.kind === "upstream") throw new ServiceUnavailableException(upstreamMessage)
      throw new BadGatewayException("Le service IA a renvoyé une réponse invalide.")
    }
  }

  async analyze(offerText: string) {
    return this.callAiForRoute("/analyze-offer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offer_text: offerText }),
    })
  }

  async aiHealth() {
    try {
      const service = await this.callAi<{ status: string }>("/health", { method: "GET" })
      const ollama = await this.callAi<{ status: string; model?: string }>("/health/ollama", { method: "GET" })
      return { status: service.status === "ok" && ollama.status === "ok" ? "ok" : "unavailable", ollama }
    } catch {
      return { status: "unavailable" }
    }
  }

  async parseCv(file: Express.Multer.File) {
    const form = new FormData()
    form.append("file", new Blob([Uint8Array.from(file.buffer)], { type: file.mimetype }), file.originalname)
    return this.callAiForRoute("/parse-cv", { method: "POST", body: form })
  }

  async create(userId: string, dto: CreateSessionDto) {
    const session = await this.sessions.create({
      id: randomUUID(),
      userId,
      offerText: dto.offerText,
      offer: dto.offer,
      cvText: dto.cvText,
      config: { type: dto.type, count: dto.count, level: dto.level },
      status: "generating",
    })
    void this.generate(session.id, userId, dto)
    return { id: session.id, status: session.status }
  }

  private async generate(id: string, userId: string, dto: CreateSessionDto) {
    try {
      const result = await this.callAi<{ questions: AiQuestion[] }>("/generate-session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offer: dto.offer,
          cv_text: dto.cvText,
          type: dto.type,
          count: dto.count,
          level: dto.level,
          use_rag: true,
          verify: false,
        }),
      })
      const questions = (Array.isArray(result.questions) ? result.questions : [])
        .map((question) => ({
          skill: question.skill || "Général",
          type: "qcm",
          question: question.question || "",
          options: Array.isArray(question.options) ? question.options : [],
          correct_index: typeof question.correct_index === "number" ? question.correct_index : null,
          expected_answer: question.expected_answer || "",
          explanation: question.explanation || "",
          difficulty: question.difficulty || dto.level,
          source: question.source || null,
          verified: question.verified ?? null,
        }))
        .filter((question) => question.question.length > 0 && question.options.length === 4)
      if (questions.length === 0) throw new AiRequestError("invalid_response")
      await this.sessions.updateOne({ id, userId }, { $set: { status: "ready", questions } })
    } catch (error) {
      const message = error instanceof AiRequestError && error.kind === "timeout"
        ? timeoutMessage
        : error instanceof AiRequestError && error.kind === "unavailable"
          ? unavailableMessage
          : error instanceof AiRequestError && error.kind === "upstream"
            ? upstreamMessage
          : "La génération de la session a échoué."
      await this.sessions.updateOne({ id, userId }, { $set: { status: "failed", error: message } })
    }
  }

  private async owned(id: string, userId: string) {
    const session = await this.sessions.findOne({ id, userId }).exec()
    if (!session) throw new NotFoundException("Session introuvable.")
    if (session.status === "generating" && Date.now() - new Date(session.createdAt).getTime() > 15 * 60 * 1000) {
      session.status = "failed"
      session.error = "La génération a dépassé le délai maximal."
      await session.save()
    }
    return session
  }

  private safeQuestion(question: AiQuestion, answered: boolean) {
    const plain = typeof (question as AiQuestion & { toObject?: () => AiQuestion }).toObject === "function"
      ? (question as AiQuestion & { toObject: () => AiQuestion }).toObject()
      : question
    const normalized: AiQuestion = {
      skill: plain.skill || "Général",
      type: "qcm",
      question: plain.question || "",
      options: Array.isArray(plain.options) ? plain.options : [],
      correct_index: typeof plain.correct_index === "number" ? plain.correct_index : null,
      expected_answer: plain.expected_answer || "",
      explanation: plain.explanation || "",
      difficulty: plain.difficulty || "junior",
      source: plain.source || null,
      verified: plain.verified ?? null,
    }
    if (answered) return normalized
    const { correct_index, expected_answer, explanation, ...safe } = normalized
    return safe
  }

  async list(userId: string) {
    return this.sessions.find({ userId }).sort({ updatedAt: -1 }).select("-offerText -cvText -mockHistory").lean().exec()
  }

  async detail(id: string, userId: string) {
    const session = await this.owned(id, userId)
    const answers = new Set(session.answers.map((answer) => answer.questionIndex))
    return {
      ...session.toObject(),
      questions: session.questions.map((question, index) => this.safeQuestion(question, answers.has(index))),
    }
  }

  async answer(id: string, userId: string, dto: AnswerDto) {
    const session = await this.owned(id, userId)
    const question = session.questions[dto.questionIndex]
    if (!question) throw new NotFoundException("Question introuvable.")
    if (session.answers.some((answer) => answer.questionIndex === dto.questionIndex)) {
      return this.detail(id, userId)
    }
    const isQcm = question.type === "qcm"
    const result = isQcm
      ? {
          verdict: dto.selectedIndex === question.correct_index ? "correct" : "incorrect",
          score: dto.selectedIndex === question.correct_index ? 100 : 0,
          feedback: dto.selectedIndex === question.correct_index ? "Bonne réponse." : "Ce n'est pas la bonne réponse.",
        }
      : await this.callAiForRoute<{ verdict: string; score: number; feedback: string }>("/evaluate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question: question.question,
            expected_answer: question.expected_answer,
            user_answer: dto.answer || "",
            skill: question.skill,
            level: question.difficulty,
            source: question.source,
          }),
        })
    session.answers.push({
      questionIndex: dto.questionIndex,
      userAnswer: dto.answer || null,
      selectedIndex: dto.selectedIndex ?? null,
      verdict: result.verdict,
      score: result.score,
      feedback: result.feedback,
    } as never)
    if (result.verdict !== "correct" && !session.weakSkills.includes(question.skill)) {
      session.weakSkills.push(question.skill)
      const followup = await this.callAiForRoute<{ question: AiQuestion | null }>("/followup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offer: session.offer,
          skill: question.skill,
          level: question.difficulty,
          failed_question: question.question,
          user_answer: dto.answer || question.options[dto.selectedIndex ?? -1] || "",
          asked: session.questions.map((item) => item.question),
        }),
      })
      if (followup.question) session.questions.push(followup.question as never)
    }
    await session.save()
    return this.detail(id, userId)
  }

  async mock(id: string, userId: string, dto: MockInterviewDto) {
    const session = await this.owned(id, userId)
    if (dto.message) session.mockHistory.push({ role: "user", content: dto.message })
    const result = await this.callAiForRoute<{ message: string; finished: boolean; feedback: unknown | null }>("/mock-interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ offer: session.offer, cv_text: session.cvText, history: session.mockHistory, max_turns: 5 }),
    })
    session.mockHistory.push({ role: "assistant", content: result.message })
    await session.save()
    return result
  }
}
