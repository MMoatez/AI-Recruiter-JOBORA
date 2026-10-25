import { BadGatewayException, GatewayTimeoutException, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GoogleGenAI } from "@google/genai"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { RagService } from "./rag.service"

const cvJsonSchema = {
  type: "object",
  properties: {
    professionalSummary: { type: "string" },
    education: { type: "array", items: { type: "object", properties: { id: { type: "string" }, degree: { type: "string" }, institution: { type: "string" }, location: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" }, description: { type: "string" } }, required: ["degree", "institution", "location", "startDate", "endDate", "description"] } },
    experiences: { type: "array", items: { type: "object", properties: { id: { type: "string" }, jobTitle: { type: "string" }, company: { type: "string" }, location: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" }, bulletPoints: { type: "array", items: { type: "string" } } }, required: ["jobTitle", "company", "location", "startDate", "endDate", "bulletPoints"] } },
    projects: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, technologies: { type: "array", items: { type: "string" } }, link: { type: "string" } }, required: ["name", "description", "technologies", "link"] } },
    technicalSkills: { type: "array", items: { type: "string" } }, softSkills: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "object", properties: { id: { type: "string" }, language: { type: "string" }, level: { type: "string" } }, required: ["language", "level"] } },
    certifications: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, organization: { type: "string" }, date: { type: "string" } }, required: ["name", "organization", "date"] } },
  },
  required: ["professionalSummary", "education", "experiences", "projects", "technicalSkills", "softSkills", "languages", "certifications"],
} as const

const validationSchema = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["PASS", "NEEDS_WORK"] }, score: { type: "number" }, checks: { type: "object" },
    issues: { type: "array", items: { type: "string" } }, suggestions: { type: "array", items: { type: "string" } },
  },
  required: ["status", "score", "checks", "issues", "suggestions"],
} as const

@Injectable()
export class GeminiService {
  constructor(private readonly config: ConfigService, private readonly rag: RagService) {}

  async generate(candidate: Record<string, unknown>) {
    this.requireKey()
    const rag = await this.rag.buildRagContext(this.rag.buildSearchQuery(candidate))
    const [systemPrompt, generationPrompt] = await Promise.all([this.loadPrompt("cv-system.prompt"), this.loadPrompt("cv-generation.prompt")])
    const prompt = generationPrompt.replace("{{ragContext}}", rag.context).replace("{{targetJob}}", String(candidate.targetJob ?? "")).replace("{{candidateJson}}", JSON.stringify(candidate))
    return { content: this.parseCv(await this.request(`${systemPrompt}\n\n${prompt}`, cvJsonSchema)), ragContext: rag.context, ragMetadata: rag.metadata }
  }

  async validateAts(cv: Record<string, unknown>, ragContext?: string) {
    this.requireKey()
    const context = ragContext ?? (await this.rag.buildRagContext(`Validation ATS du CV pour ${String(cv.targetJob ?? "un poste")}: sections, lisibilité, concision, compétences.`)).context
    const [systemPrompt, validationPrompt] = await Promise.all([this.loadPrompt("cv-system.prompt"), this.loadPrompt("cv-ats-validation.prompt")])
    const prompt = validationPrompt.replace("{{ragContext}}", context).replace("{{generatedCvJson}}", JSON.stringify(cv))
    return this.parseValidation(await this.request(`${systemPrompt}\n\n${prompt}`, validationSchema))
  }

  async regenerateSection(section: "summary" | "experience" | "project", source: unknown, targetJob: string) {
    this.requireKey()
    const rag = await this.rag.buildRagContext(`Règles ATS pour reformuler ${section} d'un CV ${targetJob}: style, concision, exactitude.`)
    const [systemPrompt, template] = await Promise.all([this.loadPrompt("cv-system.prompt"), this.loadPrompt("cv-section-regeneration.prompt")])
    const contentSchema = section === "experience" ? { type: "array", items: { type: "string" } } : { type: "string" }
    const schema = { type: "object", properties: { content: contentSchema }, required: ["content"] }
    const prompt = template.replace("{{ragContext}}", rag.context).replace("{{targetJob}}", targetJob).replace("{{section}}", section).replace("{{sourceJson}}", JSON.stringify(source))
    const parsed = this.parseJson(await this.request(`${systemPrompt}\n\n${prompt}`, schema)) as { content?: unknown }
    if (section === "experience" ? !Array.isArray(parsed.content) || !parsed.content.every((item) => typeof item === "string") : typeof parsed.content !== "string") {
      throw new BadGatewayException("Gemini a retourné une section invalide.")
    }
    return { content: parsed.content, ragMetadata: rag.metadata }
  }

  private requireKey() {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim()
    if (!apiKey) throw new ServiceUnavailableException("La génération IA n’est pas configurée.")
    return apiKey
  }

  private async request(input: string, schema: Record<string, unknown>) {
    const ai = new GoogleGenAI({ apiKey: this.requireKey() })
    const timeoutMs = Number(this.config.get("GEMINI_TIMEOUT_MS", 60000))
    const maxAttempts = Math.max(1, Math.min(Number(this.config.get("GEMINI_MAX_ATTEMPTS", 2)), 3))
    const retryDelayMs = Math.max(0, Number(this.config.get("GEMINI_RETRY_DELAY_MS", 1000)))

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new GatewayTimeoutException("Gemini n’a pas répondu dans le délai attendu.")), timeoutMs)
        })
        const response = await Promise.race([ai.models.generateContent({
          model: this.config.get("GEMINI_MODEL", "gemini-3.5-flash-lite"),
          contents: input,
          config: { responseMimeType: "application/json", responseJsonSchema: schema },
        }), timeout])
        if (!response.text) throw new Error("Empty Gemini response")
        return response.text
      } catch (error) {
        if (!this.isTransientError(error) || attempt === maxAttempts) {
          if (error instanceof GatewayTimeoutException || error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error
          throw new BadGatewayException("Le service Gemini est temporairement indisponible.")
        }
        await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelayMs * attempt))
      } finally {
        if (timer) clearTimeout(timer)
      }
    }

    throw new BadGatewayException("Le service Gemini est temporairement indisponible.")
  }

  private isTransientError(error: unknown) {
    if (error instanceof GatewayTimeoutException) return true
    if (!error || typeof error !== "object") return false
    const status = Number((error as { status?: unknown }).status)
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
  }

  private async loadPrompt(name: string) {
    const directory = resolve(this.config.get("PROMPTS_DIR", resolve(process.cwd(), "prompts")))
    return readFile(resolve(directory, name), "utf8")
  }

  private parseJson(raw: string) {
    try {
      const value = JSON.parse(raw) as unknown
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid object")
      return value as Record<string, unknown>
    } catch { throw new BadGatewayException("Gemini a retourné une réponse JSON invalide.") }
  }

  private parseCv(raw: string) {
    const value = this.parseJson(raw)
    const isRecord = (item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)
    const hasStrings = (item: Record<string, unknown>, keys: string[]) => keys.every((key) => typeof item[key] === "string")
    const optionalIdIsValid = (item: Record<string, unknown>) => item.id === undefined || typeof item.id === "string"
    const isStringArray = (item: unknown): item is string[] => Array.isArray(item) && item.every((entry) => typeof entry === "string")
    const isObjectArray = (item: unknown, validator: (entry: Record<string, unknown>) => boolean) => Array.isArray(item) && item.every((entry) => isRecord(entry) && validator(entry))
    const valid = typeof value.professionalSummary === "string"
      && isObjectArray(value.education, (item) => optionalIdIsValid(item) && hasStrings(item, ["degree", "institution", "location", "startDate", "endDate", "description"]))
      && isObjectArray(value.experiences, (item) => optionalIdIsValid(item) && hasStrings(item, ["jobTitle", "company", "location", "startDate", "endDate"]) && isStringArray(item.bulletPoints))
      && isObjectArray(value.projects, (item) => optionalIdIsValid(item) && hasStrings(item, ["name", "description", "link"]) && isStringArray(item.technologies))
      && isStringArray(value.technicalSkills)
      && isStringArray(value.softSkills)
      && isObjectArray(value.languages, (item) => optionalIdIsValid(item) && hasStrings(item, ["language", "level"]))
      && isObjectArray(value.certifications, (item) => optionalIdIsValid(item) && hasStrings(item, ["name", "organization", "date"]))
    if (!valid) throw new BadGatewayException("Gemini a retourné un CV qui ne respecte pas le schéma attendu.")
    return value
  }

  private parseValidation(raw: string) {
    const value = this.parseJson(raw)
    if (!["PASS", "NEEDS_WORK"].includes(String(value.status)) || typeof value.score !== "number" || !value.checks || !Array.isArray(value.issues) || !Array.isArray(value.suggestions)) throw new BadGatewayException("Gemini a retourné une validation ATS invalide.")
    return { ...value, score: Math.max(0, Math.min(100, Math.round(value.score))) }
  }
}
