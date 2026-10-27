import { HttpService } from "@nestjs/axios"
import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { firstValueFrom } from "rxjs"

type OllamaChatResponse = {
  message?: {
    content?: unknown
  }
}

type OllamaEmbedResponse = {
  embeddings?: unknown
}

@Injectable()
export class OllamaService {
  private readonly url: string
  private readonly model: string
  private readonly portfolioExtractionModel: string
  private readonly embedUrl: string
  private readonly embedModel: string

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    this.url = config.get("OLLAMA_URL", "http://localhost:11434/api/chat")
    this.model = config.get("OLLAMA_MODEL", "qwen2.5:3b")
    this.portfolioExtractionModel = config.get("OLLAMA_PORTFOLIO_EXTRACTION_MODEL", this.model)
    this.embedUrl = new URL("/api/embed", this.url).toString()
    this.embedModel = config.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!texts.length) return []

    try {
      const response = await firstValueFrom(
        this.http.post<OllamaEmbedResponse>(
          this.embedUrl,
          { model: this.embedModel, input: texts },
          { timeout: 120_000 },
        ),
      )
      const embeddings = response.data.embeddings
      if (
        !Array.isArray(embeddings) ||
        embeddings.length !== texts.length ||
        embeddings.some((embedding) =>
          !Array.isArray(embedding) ||
          embedding.length === 0 ||
          embedding.some((value) => typeof value !== "number" || !Number.isFinite(value)),
        )
      ) {
        throw new BadGatewayException("Ollama a retourné des embeddings invalides.")
      }
      return embeddings as number[][]
    } catch (error) {
      if (error instanceof BadGatewayException) throw error
      throw new ServiceUnavailableException("Le service d’embeddings Ollama est temporairement indisponible.", { cause: error })
    }
  }

  async generatePortfolioExtractionJson(systemPrompt: string, userPrompt: string): Promise<unknown> {
    return this.generateJson(systemPrompt, userPrompt, 0.1, this.portfolioExtractionModel)
  }

  async generateJson(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.1,
    model = this.model,
  ): Promise<unknown> {
    let lastError: unknown

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await firstValueFrom(
          this.http.post<OllamaChatResponse>(
            this.url,
            {
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              stream: false,
              format: "json",
              options: { temperature },
            },
            { timeout: 120_000 },
          ),
        )

        const content = response.data.message?.content
        if (typeof content !== "string") {
          throw new BadGatewayException("Ollama n’a pas retourné de contenu JSON.")
        }

        return JSON.parse(content) as unknown
      } catch (error) {
        lastError = error
      }
    }

    if (lastError instanceof SyntaxError) {
      throw new BadGatewayException("Ollama a retourné un JSON invalide après 2 tentatives.")
    }
    if (lastError instanceof BadGatewayException) throw lastError
    throw new ServiceUnavailableException("Ollama est indisponible après 2 tentatives.", { cause: lastError })
  }
}
