import {
  BadGatewayException,
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { InjectModel } from "@nestjs/mongoose"
import { randomUUID } from "crypto"
import { Model } from "mongoose"
import { Cv, CvDocument } from "../cv/cv.schema"
import { GenerateLetterDto, RewriteParagraphDto, UpdateLetterDto } from "./dto/lettre.dto"
import { CoverLetter, CoverLetterDocument, LetterParagraph } from "./lettre.schema"
import { sanitizeCv, scrubText } from "./lettre.privacy"

type AuthUser = { id: string; name?: string; email?: string }

type AiLetter = {
  job_title: string
  subject: string
  salutation: string
  closing: string
  paragraphs: LetterParagraph[]
  facts: Record<string, unknown>[]
  matched_skills: string[]
  missing_skills: string[]
  warnings: string[]
  model: string
  prompt_version: string
}

const MAX_VERSIONS = 10
const unavailableMessage = "Le service IA est indisponible. Vérifie que Ollama et le service IA sont lancés."
const timeoutMessage = "La rédaction prend plus de temps que prévu. Réessaie dans un instant."
const upstreamMessage = "Le service IA n'a pas pu rédiger la lettre. Réessaie ou modifie l'offre."

class AiRequestError extends Error {
  constructor(
    readonly kind: "unavailable" | "timeout" | "upstream" | "invalid_response",
    readonly detail?: string,
  ) {
    super(kind)
  }
}

@Injectable()
export class LettreService {
  private readonly logger = new Logger(LettreService.name)
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(
    @InjectModel(CoverLetter.name) private readonly letters: Model<CoverLetterDocument>,
    @InjectModel(Cv.name) private readonly cvs: Model<CvDocument>,
    private readonly config: ConfigService,
  ) {
    this.baseUrl = this.config.get<string>("AI_SERVICE_URL", "http://127.0.0.1:8000").replace(/\/$/, "")
    this.timeoutMs = Number(this.config.get<string>("AI_SERVICE_TIMEOUT_MS", "480000"))
  }

  /** Appel HTTP vers le service FastAPI local, avec délai maximal et erreurs normalisées. */
  private async callAi<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        this.logger.warn(`AI service returned HTTP ${response.status} on ${path}`)
        throw new AiRequestError(response.status === 503 ? "unavailable" : "upstream", payload?.detail)
      }
      if (!payload) throw new AiRequestError("invalid_response")
      return payload as T
    } catch (error) {
      if (error instanceof AiRequestError) throw error
      const name = error instanceof Error ? error.name : "UnknownError"
      throw new AiRequestError(name === "AbortError" ? "timeout" : name === "TypeError" ? "unavailable" : "upstream")
    } finally {
      clearTimeout(timeout)
    }
  }

  private async callAiForRoute<T>(path: string, body: unknown): Promise<T> {
    try {
      return await this.callAi<T>(path, body)
    } catch (error) {
      if (!(error instanceof AiRequestError)) throw error
      if (error.kind === "timeout") throw new GatewayTimeoutException(timeoutMessage)
      if (error.kind === "unavailable") throw new ServiceUnavailableException(unavailableMessage)
      if (error.kind === "invalid_response") throw new BadGatewayException("Le service IA a renvoyé une réponse invalide.")
      throw new ServiceUnavailableException(upstreamMessage)
    }
  }

  private toResponse(letter: CoverLetterDocument | (CoverLetter & { _id?: unknown; __v?: unknown })) {
    const plain = typeof (letter as CoverLetterDocument).toObject === "function"
      ? (letter as CoverLetterDocument).toObject()
      : letter
    // _id et __v sont retirés (même correction que le module CV : « property _id should not exist »).
    const { _id, __v, ...rest } = plain as CoverLetter & { _id?: unknown; __v?: unknown }
    return rest
  }

  private async owned(id: string, userId: string) {
    const letter = await this.letters.findOne({ id, userId }).exec()
    if (!letter) throw new NotFoundException("Lettre introuvable.")
    return letter
  }

  private snapshot(letter: CoverLetterDocument, label: string) {
    letter.versions.push({
      label,
      subject: letter.subject,
      paragraphs: letter.paragraphs.map((p) => ({ role: p.role, text: p.text, sources: [...p.sources] })),
      savedAt: new Date(),
    } as never)
    if (letter.versions.length > MAX_VERSIONS) letter.versions.splice(0, letter.versions.length - MAX_VERSIONS)
  }

  /** Liste des CV de l'utilisateur pour le sélecteur (aucune donnée personnelle renvoyée). */
  async cvOptions(userId: string) {
    return this.cvs
      .find({ userId })
      .sort({ updatedAt: -1 })
      .select({ _id: 0, id: 1, title: 1, targetJob: 1, status: 1, updatedAt: 1 })
      .lean()
      .exec()
  }

  async generate(user: AuthUser, dto: GenerateLetterDto) {
    let cvFacts: Record<string, unknown>
    let cvTitle = "CV importé (PDF)"
    if (dto.cvId) {
      const cv = await this.cvs.findOne({ id: dto.cvId, userId: user.id }).lean().exec()
      if (!cv) throw new NotFoundException("CV introuvable.")
      cvFacts = sanitizeCv(cv, user)
      cvTitle = cv.title
    } else if (dto.cvText && dto.cvText.trim().length >= 80) {
      cvFacts = { raw_text: scrubText(dto.cvText, user.name ? [user.name] : []) }
    } else {
      throw new BadRequestException("Choisis un CV JOBORA ou importe ton CV en PDF.")
    }

    const result = await this.callAiForRoute<AiLetter>("/letter/generate", {
      offer_text: dto.offerText,
      cv: cvFacts,
      language: dto.language,
      tone: dto.tone,
      company: (dto.company || "").trim(),
    })
    if (!Array.isArray(result.paragraphs) || result.paragraphs.length !== 4) {
      throw new BadGatewayException("Le service IA a renvoyé une lettre incomplète.")
    }

    const jobTitle = (result.job_title || "").slice(0, 120)
    const letter = await this.letters.create({
      id: randomUUID(),
      userId: user.id,
      title: [jobTitle || "Lettre de motivation", dto.company].filter(Boolean).join(" · ").slice(0, 160),
      cvId: dto.cvId || null,
      cvTitle,
      offerText: dto.offerText,
      company: (dto.company || "").trim(),
      jobTitle,
      language: dto.language,
      tone: dto.tone,
      subject: result.subject || "",
      salutation: result.salutation,
      closing: result.closing,
      paragraphs: result.paragraphs,
      facts: result.facts || [],
      matchedSkills: result.matched_skills || [],
      missingSkills: result.missing_skills || [],
      warnings: result.warnings || [],
      aiModel: result.model || "",
      promptVersion: result.prompt_version || "LETTER_GENERATE_001_V1",
      status: "generated",
    })
    return this.toResponse(letter)
  }

  async list(userId: string) {
    return this.letters
      .find({ userId })
      .sort({ updatedAt: -1 })
      .select({ _id: 0, id: 1, title: 1, cvTitle: 1, company: 1, language: 1, tone: 1, status: 1, updatedAt: 1 })
      .lean()
      .exec()
  }

  async detail(id: string, userId: string) {
    return this.toResponse(await this.owned(id, userId))
  }

  /** Enregistre les modifications du candidat et conserve l'état précédent comme version. */
  async update(id: string, userId: string, dto: UpdateLetterDto) {
    const letter = await this.owned(id, userId)
    const roles = new Set(dto.paragraphs.map((p) => p.role))
    if (roles.size !== 4) throw new BadRequestException("La lettre doit contenir les quatre paragraphes.")
    this.snapshot(letter, "Avant modification manuelle")
    letter.paragraphs = dto.paragraphs.map((p) => ({ role: p.role, text: p.text.trim(), sources: p.sources })) as never
    if (dto.subject !== undefined) letter.subject = dto.subject
    letter.status = "edited"
    await letter.save()
    return this.toResponse(letter)
  }

  async rewrite(id: string, userId: string, index: number, dto: RewriteParagraphDto) {
    const letter = await this.owned(id, userId)
    const current = letter.paragraphs[index]
    if (!current) throw new NotFoundException("Paragraphe introuvable.")
    const result = await this.callAiForRoute<{ paragraph: LetterParagraph; warnings: string[] }>("/letter/rewrite", {
      role: current.role,
      action: dto.action,
      paragraph: current.text,
      facts: letter.facts,
      offer_text: letter.offerText,
      language: letter.language,
      tone: letter.tone,
      company: letter.company,
      other_paragraphs: letter.paragraphs.filter((_, i) => i !== index).map((p) => p.text),
    })
    if (!result.paragraph?.text) throw new BadGatewayException("Le service IA a renvoyé une réponse invalide.")
    this.snapshot(letter, "Avant réécriture IA")
    letter.paragraphs[index] = { role: current.role, text: result.paragraph.text, sources: result.paragraph.sources || [] } as never
    letter.markModified("paragraphs")
    letter.warnings = [...new Set([...letter.warnings, ...(result.warnings || [])])]
    letter.status = "edited"
    await letter.save()
    return this.toResponse(letter)
  }

  async remove(id: string, userId: string) {
    const result = await this.letters.deleteOne({ id, userId }).exec()
    if (result.deletedCount === 0) throw new NotFoundException("Lettre introuvable.")
    return { deleted: true }
  }
}
