import { Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"

export type RagChunk = {
  id: string
  source: string
  text: string
  score: number | null
}

export type RagResult = {
  context: string
  chunks: RagChunk[]
  metadata: {
    retrievedChunkIds: string[]
    retrievedSources: string[]
    topK: number
    embeddingModel: string
    ragQuery: string
  }
}

type PythonSearchResponse = { chunks?: unknown; embeddingModel?: unknown }
type PythonStatusResponse = {
  available?: unknown
  collection?: unknown
  chunks?: unknown
  embeddingModel?: unknown
  persistent?: unknown
  indexCurrent?: unknown
}

@Injectable()
export class RagService {
  private readonly serviceUrl: string
  private readonly topK: number
  private readonly timeoutMs: number

  constructor(private readonly config: ConfigService) {
    this.serviceUrl = config.get("RAG_SERVICE_URL", "http://127.0.0.1:8001").replace(/\/$/, "")
    this.topK = Number(config.get("RAG_TOP_K", 5))
    this.timeoutMs = Number(config.get("RAG_SERVICE_TIMEOUT_MS", 15000))
  }

  async retrieveRelevantChunks(query: string, requestedTopK = this.topK): Promise<RagChunk[]> {
    const cleanQuery = query.replace(/\s+/g, " ").trim().slice(0, 800)
    if (!cleanQuery) return []
    const response = await this.request<PythonSearchResponse>("/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: cleanQuery, top_k: Math.max(1, Math.min(requestedTopK, 10)) }),
    })
    if (!Array.isArray(response.chunks)) throw new ServiceUnavailableException("Le service RAG local a retourné une réponse invalide.")
    return response.chunks.filter((chunk): chunk is RagChunk => this.isChunk(chunk))
  }

  async buildRagContext(query: string): Promise<RagResult> {
    const chunks = await this.retrieveRelevantChunks(query)
    if (!chunks.length) throw new ServiceUnavailableException("Aucune règle ATS pertinente n’a été trouvée.")
    const status = await this.status()
    return {
      context: chunks.map((chunk, index) => `[Source ${index + 1}: ${chunk.source}]\n${chunk.text}`).join("\n\n"),
      chunks,
      metadata: {
        retrievedChunkIds: chunks.map((chunk) => chunk.id),
        retrievedSources: [...new Set(chunks.map((chunk) => chunk.source))],
        topK: this.topK,
        embeddingModel: status.embeddingModel,
        ragQuery: query,
      },
    }
  }

  buildSearchQuery(candidate: Record<string, unknown>) {
    const targetJob = String(candidate.targetJob ?? "poste non précisé").slice(0, 180)
    const topics = ["ATS sections", "professional summary", "experience bullet points", "projects", "skills", "dates"]
    const skills = Array.isArray(candidate.technicalSkills) ? candidate.technicalSkills.slice(0, 12).map(String) : []
    return `CV ATS pour ${targetJob}. Conseils sur ${topics.join(", ")}. Compétences déclarées: ${skills.join(", ") || "non précisées"}.`
  }

  async status() {
    try {
      const response = await this.request<PythonStatusResponse>("/status")
      return {
        available: response.available === true,
        collection: typeof response.collection === "string" ? response.collection : "jobora_ats_knowledge",
        chunks: typeof response.chunks === "number" ? response.chunks : 0,
        embeddingModel: typeof response.embeddingModel === "string" ? response.embeddingModel : "all-MiniLM-L6-v2",
        persistent: response.persistent === true,
        indexCurrent: response.indexCurrent === true,
      }
    } catch {
      return {
        available: false,
        collection: "jobora_ats_knowledge",
        chunks: 0,
        embeddingModel: "all-MiniLM-L6-v2",
        persistent: true,
        indexCurrent: false,
      }
    }
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    try {
      const response = await fetch(`${this.serviceUrl}${path}`, { ...init, signal: controller.signal })
      if (!response.ok) throw new Error(`RAG service returned ${response.status}`)
      return await response.json() as T
    } catch {
      throw new ServiceUnavailableException("Le service RAG local est temporairement indisponible.")
    } finally {
      clearTimeout(timer)
    }
  }

  private isChunk(value: unknown): value is RagChunk {
    if (!value || typeof value !== "object") return false
    const chunk = value as Record<string, unknown>
    return typeof chunk.id === "string" && typeof chunk.source === "string" && typeof chunk.text === "string" && (typeof chunk.score === "number" || chunk.score === null)
  }
}
