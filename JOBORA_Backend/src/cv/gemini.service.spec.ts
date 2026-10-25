import { BadGatewayException, GatewayTimeoutException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GeminiService } from "./gemini.service"

const rag = { buildRagContext: jest.fn(), buildSearchQuery: jest.fn() }
const serviceWith = (values: Record<string, unknown>) => new GeminiService(new ConfigService(values), rag as never)

describe("GeminiService", () => {
  it("fails cleanly when the API key is missing", async () => {
    await expect(serviceWith({}).generate({})).rejects.toBeInstanceOf(ServiceUnavailableException)
  })
  it("rejects malformed JSON", () => {
    expect(() => (serviceWith({ GEMINI_API_KEY: "test" }) as unknown as { parseCv: (value: string) => unknown }).parseCv("not-json")).toThrow(BadGatewayException)
  })
  it("rejects JSON that does not match the CV schema", () => {
    expect(() => (serviceWith({ GEMINI_API_KEY: "test" }) as unknown as { parseCv: (value: string) => unknown }).parseCv("{}")).toThrow(BadGatewayException)
  })
  it("accepts a valid structured response", () => {
    const raw = JSON.stringify({ professionalSummary: "Profil", education: [], experiences: [], projects: [], technicalSkills: [], softSkills: [], languages: [], certifications: [] })
    const parsed = (serviceWith({ GEMINI_API_KEY: "test" }) as unknown as { parseCv: (value: string) => { professionalSummary: string } }).parseCv(raw)
    expect(parsed.professionalSummary).toBe("Profil")
  })
  it("rejects invalid nested CV fields", () => {
    const raw = JSON.stringify({ professionalSummary: "Profil", education: [], experiences: [{ jobTitle: "Dev", company: "Jobora", location: "", startDate: "2025", endDate: "2026", bulletPoints: [42] }], projects: [], technicalSkills: [], softSkills: [], languages: [], certifications: [] })
    expect(() => (serviceWith({ GEMINI_API_KEY: "test" }) as unknown as { parseCv: (value: string) => unknown }).parseCv(raw)).toThrow(BadGatewayException)
  })
  it("includes the retrieved RAG context in the Gemini generation prompt", async () => {
    const localRag = {
      buildSearchQuery: jest.fn().mockReturnValue("CV ATS pour développeur"),
      buildRagContext: jest.fn().mockResolvedValue({
        context: "RAG_CONTEXT_MARKER: use concise achievement bullets",
        metadata: { retrievedChunkIds: ["chunk-1"], retrievedSources: ["experience_rules.txt"], topK: 1, embeddingModel: "all-MiniLM-L6-v2", ragQuery: "CV ATS pour développeur" },
      }),
    }
    const service = new GeminiService(new ConfigService({ GEMINI_API_KEY: "test" }), localRag as never)
    const raw = JSON.stringify({ professionalSummary: "Profil", education: [], experiences: [], projects: [], technicalSkills: [], softSkills: [], languages: [], certifications: [] })
    const request = jest.spyOn(service as unknown as { request: (prompt: string, schema: unknown) => Promise<string> }, "request").mockResolvedValue(raw)

    await service.generate({ targetJob: "Développeur" })

    expect(localRag.buildRagContext).toHaveBeenCalledWith("CV ATS pour développeur")
    expect(request.mock.calls[0][0]).toContain("RAG_CONTEXT_MARKER: use concise achievement bullets")
  })
  it("rejects an invalid ATS validation payload", () => {
    expect(() => (serviceWith({ GEMINI_API_KEY: "test" }) as unknown as { parseValidation: (value: string) => unknown }).parseValidation('{"status":"PASS"}')).toThrow(BadGatewayException)
  })
  it("retries only temporary Gemini failures", () => {
    const service = serviceWith({ GEMINI_API_KEY: "test" }) as unknown as { isTransientError: (error: unknown) => boolean }
    expect(service.isTransientError(new GatewayTimeoutException())).toBe(true)
    expect(service.isTransientError({ status: 429 })).toBe(true)
    expect(service.isTransientError({ status: 503 })).toBe(true)
    expect(service.isTransientError({ status: 400 })).toBe(false)
    expect(service.isTransientError(new Error("invalid request"))).toBe(false)
  })
})
