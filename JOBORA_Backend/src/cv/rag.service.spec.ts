import { ConfigService } from "@nestjs/config"
import { RagService } from "./rag.service"

describe("RagService", () => {
  afterEach(() => jest.restoreAllMocks())

  it("returns no chunks for an empty query without contacting Python", async () => {
    const service = new RagService(new ConfigService({ RAG_TOP_K: "3" }))
    const fetchSpy = jest.spyOn(global, "fetch")
    await expect(service.retrieveRelevantChunks("   ")).resolves.toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns traceable chunks from the Python service", async () => {
    const service = new RagService(new ConfigService({ RAG_TOP_K: "3" }))
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ chunks: [{ id: "chunk-1", source: "ats_rules.txt", text: "Use standard headings.", score: 0.91 }] }),
    } as Response)
    await expect(service.retrieveRelevantChunks("standard ATS headings")).resolves.toEqual([
      { id: "chunk-1", source: "ats_rules.txt", text: "Use standard headings.", score: 0.91 },
    ])
    expect(fetchSpy).toHaveBeenCalledWith("http://127.0.0.1:8001/search", expect.objectContaining({ method: "POST" }))
  })

  it("builds a query without personal contact data", () => {
    const service = new RagService(new ConfigService())
    const query = service.buildSearchQuery({ targetJob: "Data analyst", technicalSkills: ["Python"], personalInformation: { email: "private@example.test" } })
    expect(query).toContain("Data analyst")
    expect(query).toContain("Python")
    expect(query).not.toContain("private@example.test")
  })

  it("builds context and metadata from retrieved chunks", async () => {
    const service = new RagService(new ConfigService({ RAG_TOP_K: "2" }))
    jest.spyOn(service, "retrieveRelevantChunks").mockResolvedValue([
      { id: "chunk-1", source: "ats_rules.txt", text: "Use standard headings.", score: 0.91 },
    ])
    jest.spyOn(service, "status").mockResolvedValue({
      available: true, collection: "jobora_ats_knowledge", chunks: 6, embeddingModel: "all-MiniLM-L6-v2", persistent: true, indexCurrent: true,
    })
    const result = await service.buildRagContext("ATS rules")
    expect(result.context).toContain("ats_rules.txt")
    expect(result.metadata.retrievedChunkIds).toEqual(["chunk-1"])
    expect(result.metadata.embeddingModel).toBe("all-MiniLM-L6-v2")
  })

  it("reports unavailable when Python cannot be reached", async () => {
    const service = new RagService(new ConfigService())
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("offline"))
    await expect(service.status()).resolves.toEqual(expect.objectContaining({ available: false, chunks: 0, persistent: true }))
  })

  it("rejects an empty retrieval result", async () => {
    const service = new RagService(new ConfigService())
    jest.spyOn(service, "retrieveRelevantChunks").mockResolvedValueOnce([])
    await expect(service.buildRagContext("ATS rules")).rejects.toThrow("Aucune règle ATS")
  })
})
