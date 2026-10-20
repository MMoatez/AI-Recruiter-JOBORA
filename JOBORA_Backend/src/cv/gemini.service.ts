import { BadGatewayException, GatewayTimeoutException, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GoogleGenAI } from "@google/genai"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { RagService } from "./rag.service"

const cvJsonSchema = {
  type: "object",
  properties: {
    professionalSummary: { type: "string" }, education: { type: "array", items: { type: "object" } },
    experiences: { type: "array", items: { type: "object" } }, projects: { type: "array", items: { type: "object" } },
    technicalSkills: { type: "array", items: { type: "string" } }, softSkills: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "object" } }, certifications: { type: "array", items: { type: "object" } },
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
    const timeoutMs = Number(this.config.get("GEMINI_TIMEOUT_MS", 30000))
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new GatewayTimeoutException("Gemini n’a pas répondu dans le délai attendu.")), timeoutMs) })
      const interaction = await Promise.race([ai.interactions.create({
        model: this.config.get("GEMINI_MODEL", "gemini-3.8-flash"), input,
        response_format: { type: "text", mime_type: "application/json", schema },
      }), timeout])
      if (!interaction.output_text) throw new Error("Empty Gemini response")
      return interaction.output_text
    } catch (error) {
      if (error instanceof GatewayTimeoutException || error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error
      throw new BadGatewayException("Le service Gemini est temporairement indisponible.")
    } finally { if (timer) clearTimeout(timer) }
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
    const arrays = ["education", "experiences", "projects", "technicalSkills", "softSkills", "languages", "certifications"]
    if (typeof value.professionalSummary !== "string" || arrays.some((key) => !Array.isArray(value[key]))) throw new BadGatewayException("Gemini a retourné un CV qui ne respecte pas le schéma attendu.")
    return value
  }

  private parseValidation(raw: string) {
    const value = this.parseJson(raw)
    if (!["PASS", "NEEDS_WORK"].includes(String(value.status)) || typeof value.score !== "number" || !value.checks || !Array.isArray(value.issues) || !Array.isArray(value.suggestions)) throw new BadGatewayException("Gemini a retourné une validation ATS invalide.")
    return { ...value, score: Math.max(0, Math.min(100, Math.round(value.score))) }
  }
}
