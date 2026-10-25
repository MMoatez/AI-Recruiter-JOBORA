import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import PortfolioPage from "./PortfolioPage"
import { createPortfolioRecord } from "./portfolioTestFixtures"

const mocks = vi.hoisted(() => ({
  getMyPortfolio: vi.fn(),
  updatePortfolio: vi.fn(),
  setTemplate: vi.fn(),
  other: vi.fn(),
}))

vi.mock("../../api/portfolioApi", () => ({
  extractPortfolioFromCv: mocks.other,
  generatePortfolio: mocks.other,
  getMyPortfolio: mocks.getMyPortfolio,
  portfolioSourceTextFromCv: mocks.other,
  regenerateAbout: mocks.other,
  updatePortfolio: mocks.updatePortfolio,
  setTemplate: mocks.setTemplate,
  syncPortfolio: mocks.other,
  publishPortfolio: mocks.other,
  unpublishPortfolio: mocks.other,
}))

vi.mock("../cv/cvService", () => ({
  cvService: { list: mocks.other },
}))

describe("Portfolio section panel", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.getMyPortfolio.mockResolvedValue(createPortfolioRecord())
    mocks.updatePortfolio.mockImplementation(async (data) => createPortfolioRecord(data))
  })

  it("hides a section from the preview and reorders sections in the preview", async () => {
    const user = userEvent.setup()
    const { container } = render(<PortfolioPage />)
    await waitFor(() => expect(screen.getByText("Synchronisé avec ton CV")).toBeInTheDocument())

    const preview = container.querySelector<HTMLIFrameElement>(".portfolio-preview-frame")
    expect(preview).not.toBeNull()
    expect(preview?.getAttribute("srcdoc")).toContain("Jobora")

    await user.click(screen.getByRole("button", { name: "Masquer Projets" }))
    await waitFor(() => expect(preview?.getAttribute("srcdoc")).not.toContain("Jobora"))

    await user.click(screen.getByRole("button", { name: "Afficher Projets" }))
    await waitFor(() => expect(preview?.getAttribute("srcdoc")).toContain("Jobora"))

    Array.from(container.querySelectorAll<HTMLElement>(".section-list-row")).forEach((row, index) => {
      const top = index * 40
      vi.spyOn(row, "getBoundingClientRect").mockReturnValue({
        x: 0,
        y: top,
        top,
        right: 250,
        bottom: top + 40,
        left: 0,
        width: 250,
        height: 40,
        toJSON: () => ({}),
      })
    })

    const projectDragHandle = screen.getByRole("button", { name: "Déplacer la section Projets" })
    projectDragHandle.focus()
    fireEvent.keyDown(projectDragHandle, { code: "Space", key: " " })
    await waitFor(() => expect(projectDragHandle.closest(".section-list-row")).toHaveClass("dragging"))
    fireEvent.keyDown(projectDragHandle, { code: "ArrowUp", key: "ArrowUp" })
    fireEvent.keyDown(projectDragHandle, { code: "Space", key: " " })

    await waitFor(() => {
      const srcDoc = preview?.getAttribute("srcdoc") ?? ""
      expect(srcDoc.indexOf("<h3>Projets</h3>")).toBeLessThan(srcDoc.indexOf("<h3>Expériences</h3>"))
    })
  })
})
