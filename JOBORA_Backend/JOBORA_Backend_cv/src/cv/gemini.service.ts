import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GoogleGenAI } from "@google/genai"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"

const cvJsonSchema = {
  type: "object",
  properties: {
    professionalSummary: { type: "string" },
    education: { type: "array", items: { type: "object" } },
    experiences: { type: "array", items: { type: "object" } },
    projects: { type: "array", items: { type: "object" } },
    technicalSkills: { type: "array", items: { type: "string" } },
    softSkills: { type: "array", items: { type: "string" } },
    languages: { type: "array", items: { type: "object" } },
    certifications: { type: "array", items: { type: "object" } },
  },
  required: ["professionalSummary", "education", "experiences", "projects", "technicalSkills", "softSkills", "languages", "certifications"],
} as const

@Injectable()
export class GeminiService {
  constructor(private readonly config: ConfigService) {}

  async generate(candidate: Record<string, unknown>) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim()
    if (!apiKey) throw new ServiceUnavailableException("La génération IA n’est pas configurée.")
    const [systemPrompt, generationPrompt] = await Promise.all([this.loadPrompt("cv-system.prompt"), this.loadPrompt("cv-generation.prompt")])
    const prompt = generationPrompt
      .replace("{{targetJob}}", String(candidate.targetJob ?? ""))
      .replace("{{candidateJson}}", JSON.stringify(candidate))
    try {
      const ai = new GoogleGenAI({ apiKey })
      const interaction = await ai.interactions.create({
        model: this.config.get("GEMINI_MODEL", "gemini-3.8-flash"),
        input: `${systemPrompt}\n\n${prompt}`,
        response_format: { type: "text", mime_type: "application/json", schema: cvJsonSchema },
      })
      if (!interaction.output_text) throw new Error("Empty Gemini response")
      return this.parse(interaction.output_text)
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      throw new BadGatewayException("Le service Gemini est temporairement indisponible.")
    }
  }

  async regenerateSection(section: "summary" | "experience" | "project", source: unknown, targetJob: string) {
    const apiKey = this.config.get<string>("GEMINI_API_KEY")?.trim()
    if (!apiKey) throw new ServiceUnavailableException("La génération IA n’est pas configurée.")
    const systemPrompt = await this.loadPrompt("cv-system.prompt")
    const contentSchema = section === "experience"
      ? { type: "array", items: { type: "string" } }
      : { type: "string" }
    const schema = { type: "object", properties: { content: contentSchema }, required: ["content"] }
    const task = section === "summary"
      ? "Réécris uniquement le résumé professionnel."
      : section === "experience"
        ? "Transforme uniquement cette description d’expérience en points concis commençant par des verbes d’action."
        : "Réécris uniquement la description de ce projet."
    try {
      const ai = new GoogleGenAI({ apiKey })
      const interaction = await ai.interactions.create({
        model: this.config.get("GEMINI_MODEL", "gemini-3.8-flash"),
        input: `${systemPrompt}\n\n${task}\nPoste ciblé: ${targetJob}\n<data>${JSON.stringify(source)}</data>\nRetourne uniquement {"content": ...}.`,
        response_format: { type: "text", mime_type: "application/json", schema },
      })
      if (!interaction.output_text) throw new Error("Empty Gemini response")
      const parsed = JSON.parse(interaction.output_text) as { content?: unknown }
      if (section === "experience" ? !Array.isArray(parsed.content) : typeof parsed.content !== "string") throw new Error("Invalid section response")
      return parsed.content
    } catch {
      throw new BadGatewayException("Gemini n’a pas pu régénérer cette section.")
    }
  }

  private async loadPrompt(name: string) {
    const configured = this.config.get<string>("PROMPTS_DIR")
    const directory = configured ? resolve(configured) : resolve(process.cwd(), "..", "src", "modules", "cv", "documentation", "prompts")
    return readFile(resolve(directory, name), "utf8")
  }

  private parse(raw: string) {
    try {
      const value = JSON.parse(raw) as Record<string, unknown>
      const arrays = ["education", "experiences", "projects", "technicalSkills", "softSkills", "languages", "certifications"]
      if (typeof value.professionalSummary !== "string" || arrays.some((key) => !Array.isArray(value[key]))) throw new Error("Invalid schema")
      return value
    } catch {
      throw new BadGatewayException("Gemini a retourné une réponse invalide.")
    }
  }
}
