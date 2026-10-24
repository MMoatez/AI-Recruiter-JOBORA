import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ApiError } from "../../services/api"
import { createPortfolioRecord } from "./portfolioTestFixtures"
import PublicPortfolioPage from "./PublicPortfolioPage"

const mocks = vi.hoisted(() => ({
  getPublicPortfolio: vi.fn(),
}))

vi.mock("../../api/portfolioApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../api/portfolioApi")>()
  return { ...actual, getPublicPortfolio: mocks.getPublicPortfolio }
})

function renderPublicPage(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/p/${slug}`]}>
      <Routes>
        <Route path="/p/:slug" element={<PublicPortfolioPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("public portfolio route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.title = "JOBORA"
  })

  it("renders the portfolio when the slug exists", async () => {
    const record = createPortfolioRecord()
    mocks.getPublicPortfolio.mockResolvedValue({
      slug: record.slug,
      templateId: record.templateId,
      status: "published",
      publishedAt: "2026-10-24T12:00:00.000Z",
      data: record.data,
    })

    const { container } = renderPublicPage(record.slug ?? "")

    const preview = await screen.findByTitle("Portfolio public de Fatma Ben Ali")
    expect(preview).toBeInTheDocument()
    expect(preview).toHaveAttribute("srcdoc", expect.stringContaining("Jobora"))
    await waitFor(() => expect(document.title).toBe("Fatma Ben Ali — Portfolio"))
    expect(container.querySelector(".portfolio-public-not-found")).not.toBeInTheDocument()
  })

  it("shows a not-found page when the slug does not exist", async () => {
    mocks.getPublicPortfolio.mockRejectedValue(new ApiError(404, "Portfolio introuvable."))

    renderPublicPage("unknown-slug")

    expect(await screen.findByRole("heading", { name: "Portfolio introuvable" })).toBeInTheDocument()
    expect(screen.getByText("Ce portfolio n’existe pas ou n’est plus publié.")).toBeInTheDocument()
  })
})
