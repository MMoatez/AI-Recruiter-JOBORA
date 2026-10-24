import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PORTFOLIO_TEMPLATES } from "./PortfolioTemplates"
import { createPortfolioData } from "./portfolioTestFixtures"

const TEMPLATE_IDS = ["developer", "student", "minimal", "modern", "professional"] as const

describe.each(TEMPLATE_IDS)("portfolio template %s", (templateId) => {
  const Template = PORTFOLIO_TEMPLATES[templateId]

  it("renders the profile name, title, and project", () => {
    const data = createPortfolioData()
    render(<Template data={data} sections={data.sections} theme={data.theme} />)

    expect(screen.getByText("Fatma Ben Ali")).toBeInTheDocument()
    expect(screen.getByText("Développeuse full-stack")).toBeInTheDocument()
    expect(screen.getByText("Jobora")).toBeInTheDocument()
  })

  it("does not render empty sections or demonstration text for a nearly empty portfolio", () => {
    const data = createPortfolioData()
    data.fullName = ""
    data.title = ""
    data.headline = ""
    data.availableForWork = false
    data.projects = []
    data.about = ""
    data.experiences = []
    data.education = []
    data.certifications = []
    data.skills = { languages: [], frameworks: [], tools: [], databases: [], other: [] }
    data.languages = []
    data.email = ""
    data.phone = ""
    data.location = ""
    data.links = { linkedin: "", github: "", website: "" }

    const { container } = render(<Template data={data} sections={data.sections} theme={data.theme} />)

    expect(container.querySelectorAll("section")).toHaveLength(0)
    expect(within(container).queryByText(/exemple|demo|démonstration|placeholder/i)).not.toBeInTheDocument()
  })
})
