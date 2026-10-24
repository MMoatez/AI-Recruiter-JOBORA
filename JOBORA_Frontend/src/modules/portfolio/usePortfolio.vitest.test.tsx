import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPortfolioRecord } from "./portfolioTestFixtures"
import { usePortfolio } from "./usePortfolio"

const mocks = vi.hoisted(() => ({
  getMyPortfolio: vi.fn(),
  updatePortfolio: vi.fn(),
  setTemplate: vi.fn(),
  api: vi.fn(),
}))

vi.mock("../../api/portfolioApi", () => ({
  extractPortfolioFromCv: mocks.api,
  generatePortfolio: mocks.api,
  getMyPortfolio: mocks.getMyPortfolio,
  portfolioSourceTextFromCv: mocks.api,
  regenerateAbout: mocks.api,
  updatePortfolio: mocks.updatePortfolio,
  setTemplate: mocks.setTemplate,
  syncPortfolio: mocks.api,
  publishPortfolio: mocks.api,
  unpublishPortfolio: mocks.api,
}))

vi.mock("../cv/cvService", () => ({
  cvService: { list: mocks.api },
}))

describe("usePortfolio", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.getMyPortfolio.mockResolvedValue(createPortfolioRecord())
    mocks.updatePortfolio.mockImplementation(async (data) => createPortfolioRecord(data))
  })

  it("tracks edits, saves them, and reset restores the saved data", async () => {
    const { result } = renderHook(() => usePortfolio())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isDirty).toBe(false)

    act(() => result.current.update("fullName", "Fatma B."))
    expect(result.current.isDirty).toBe(true)
    expect(result.current.draft.fullName).toBe("Fatma B.")

    await act(async () => {
      await expect(result.current.save()).resolves.toBe(true)
    })
    expect(mocks.updatePortfolio).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "Fatma B." }),
    )
    expect(result.current.isDirty).toBe(false)

    act(() => result.current.update("fullName", "Unsaved change"))
    expect(result.current.isDirty).toBe(true)
    act(() => result.current.reset())

    expect(result.current.draft.fullName).toBe("Fatma B.")
    expect(result.current.isDirty).toBe(false)
  })
})
