import { HttpService } from "@nestjs/axios"
import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { of, throwError } from "rxjs"
import { OllamaService } from "./ollama.service"

describe("OllamaService", () => {
  const makeService = (post: jest.Mock, config: Record<string, unknown> = {}) =>
    new OllamaService({ post } as unknown as HttpService, new ConfigService(config))

  it("sends the configured chat request and parses the JSON response", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { message: { content: '{"ready":true}' } } }))
    const service = makeService(post, {
      OLLAMA_URL: "http://ollama.test/api/chat",
      OLLAMA_MODEL: "custom-model",
    })

    await expect(service.generateJson("system prompt", "user prompt")).resolves.toEqual({ ready: true })
    expect(post).toHaveBeenCalledWith(
      "http://ollama.test/api/chat",
      {
        model: "custom-model",
        messages: [
          { role: "system", content: "system prompt" },
          { role: "user", content: "user prompt" },
        ],
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
      },
      { timeout: 120_000 },
    )
  })

  it("uses an explicitly requested generation temperature", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { message: { content: '{"about":"Bonjour."}' } } }))
    const service = makeService(post)

    await service.generateJson("system", "user", 0.3)

    expect(post.mock.calls[0][1].options).toEqual({ temperature: 0.3 })
  })

  it("uses the dedicated fine-tuned model only for portfolio extraction", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { message: { content: '{"projects":[]}' } } }))
    const service = makeService(post, {
      OLLAMA_MODEL: "general-model",
      OLLAMA_PORTFOLIO_EXTRACTION_MODEL: "portfolio-extractor",
    })

    await service.generatePortfolioExtractionJson("system", "cv text")
    await service.generateJson("system", "portfolio copy")

    expect(post.mock.calls[0][1].model).toBe("portfolio-extractor")
    expect(post.mock.calls[1][1].model).toBe("general-model")
  })

  it("sends embedding requests to /api/embed with the configured embedding model", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { embeddings: [[1, 0], [0, 1]] } }))
    const service = makeService(post, {
      OLLAMA_URL: "http://ollama.test/api/chat",
      OLLAMA_EMBED_MODEL: "custom-embedding-model",
    })

    await expect(service.embed(["project text", "job text"])).resolves.toEqual([[1, 0], [0, 1]])
    expect(post).toHaveBeenCalledWith(
      "http://ollama.test/api/embed",
      { model: "custom-embedding-model", input: ["project text", "job text"] },
      { timeout: 120_000 },
    )
  })

  it("returns no embeddings for an empty input without making a request", async () => {
    const post = jest.fn()
    const service = makeService(post)

    await expect(service.embed([])).resolves.toEqual([])
    expect(post).not.toHaveBeenCalled()
  })

  it("rejects malformed embedding responses", async () => {
    const post = jest.fn().mockReturnValue(of({ data: { embeddings: [[1, Number.NaN]] } }))
    const service = makeService(post)

    await expect(service.embed(["text"])).rejects.toThrow("Ollama a retourné des embeddings invalides.")
  })

  it("retries invalid JSON once and throws a clear error", async () => {
    const post = jest.fn()
      .mockReturnValueOnce(of({ data: { message: { content: "not JSON" } } }))
      .mockReturnValueOnce(of({ data: { message: { content: "still not JSON" } } }))
    const service = makeService(post)

    await expect(service.generateJson("system", "user")).rejects.toThrow(
      new BadGatewayException("Ollama a retourné un JSON invalide après 2 tentatives."),
    )
    expect(post).toHaveBeenCalledTimes(2)
  })

  it("retries a failed request once before reporting Ollama unavailable", async () => {
    const failure = new Error("connection refused")
    const post = jest.fn().mockReturnValue(throwError(() => failure))
    const service = makeService(post)

    await expect(service.generateJson("system", "user")).rejects.toBeInstanceOf(ServiceUnavailableException)
    expect(post).toHaveBeenCalledTimes(2)
  })
})
