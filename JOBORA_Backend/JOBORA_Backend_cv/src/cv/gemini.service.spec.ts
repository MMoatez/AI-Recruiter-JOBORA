import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common"
import { ConfigService } from "@nestjs/config"
import { GeminiService } from "./gemini.service"

describe("GeminiService", () => {
  it("fails cleanly when the API key is missing", async () => {
    const service = new GeminiService(new ConfigService({}))
    await expect(service.generate({})).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it("rejects malformed JSON", () => {
    const service = new GeminiService(new ConfigService({ GEMINI_API_KEY: "test" }))
    expect(() => (service as unknown as { parse: (value: string) => unknown }).parse("not-json")).toThrow(BadGatewayException)
  })

  it("rejects JSON that does not match the CV schema", () => {
    const service = new GeminiService(new ConfigService({ GEMINI_API_KEY: "test" }))
    expect(() => (service as unknown as { parse: (value: string) => unknown }).parse("{}")).toThrow(BadGatewayException)
  })

  it("accepts a valid structured response", () => {
    const service = new GeminiService(new ConfigService({ GEMINI_API_KEY: "test" }))
    const raw = JSON.stringify({ professionalSummary: "Profil", education: [], experiences: [], projects: [], technicalSkills: [], softSkills: [], languages: [], certifications: [] })
    expect((service as unknown as { parse: (value: string) => { professionalSummary: string } }).parse(raw).professionalSummary).toBe("Profil")
  })
})
