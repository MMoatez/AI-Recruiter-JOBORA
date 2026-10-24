import "reflect-metadata"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import { emptyPortfolioData, normalize, validateAgainstSource } from "./portfolio-data"
import { PortfolioDataDto } from "./portfolio.dto"

describe("PortfolioData helpers", () => {
  it("creates a fresh empty portfolio with all required fields", () => {
    const first = emptyPortfolioData()
    const second = emptyPortfolioData()

    expect(first).toEqual({
      fullName: "",
      title: "",
      headline: "",
      availableForWork: true,
      showCvDownload: false,
      email: "",
      phone: "",
      location: "",
      links: { linkedin: "", github: "", website: "" },
      sections: [
        { id: "home", visible: true, order: 0 },
        { id: "about", visible: true, order: 1 },
        { id: "skills", visible: true, order: 2 },
        { id: "experiences", visible: true, order: 3 },
        { id: "projects", visible: true, order: 4 },
        { id: "certifications", visible: true, order: 5 },
        { id: "contact", visible: true, order: 6 },
      ],
      theme: { accentColor: "#5b5bd6" },
      contactVisibility: { email: false, phone: false },
      about: "",
      education: [],
      experiences: [],
      projects: [],
      skills: { languages: [], frameworks: [], tools: [], databases: [], other: [] },
      languages: [],
      certifications: [],
    })
    expect(first).not.toBe(second)
    expect(first.links).not.toBe(second.links)
    expect(first.skills).not.toBe(second.skills)
  })

  it("normalizes an empty object into a complete, valid default structure", async () => {
    const normalized = normalize({})

    expect(normalized).toEqual(emptyPortfolioData())
    expect(await validate(plainToInstance(PortfolioDataDto, normalized))).toEqual([])
  })

  it.each([
    ["keeps a technology present in the source", "TypeScript", "Project: used TypeScript for this work.", ["TypeScript"], []],
    ["removes a technology absent from the source", "TypeScript", "Project: created a web application.", [], [
      { field: "projects[0].technologies[0]", value: "TypeScript" },
    ]],
    ["matches technology names regardless of case", "TypeScript", "Project: built with TYPESCRIPT.", ["TypeScript"], []],
    ["matches technology names regardless of accents", "Électricité", "Project: compétences en electricite.", ["Électricité"], []],
  ])("%s", (_description, technology, source, kept, removed) => {
    const data = normalize({
      projects: [{ name: "Project", technologies: [technology] }],
    })

    const result = validateAgainstSource(data, source)

    expect(result.cleaned.projects[0]?.technologies).toEqual(kept)
    expect(result.removedItems).toEqual(removed)
  })

  it("fills missing top-level, nested object and array-item fields", () => {
    expect(normalize({
      fullName: "Ada Lovelace",
      availableForWork: false,
      showCvDownload: true,
      links: { github: "https://github.com/ada" },
      sections: [{ id: "projects", visible: false }],
      theme: { accentColor: "#112233" },
      contactVisibility: { email: true },
      education: [{ school: "University" }],
      experiences: [{ company: "Analytical Engines", technologies: ["TypeScript"] }],
      projects: [{ name: "Engine" }],
      skills: { frameworks: ["NestJS"] },
      languages: [{ name: "English" }],
      certifications: [{ name: "Certificate", year: "2025" }],
    })).toEqual({
      ...emptyPortfolioData(),
      fullName: "Ada Lovelace",
      availableForWork: false,
      showCvDownload: true,
      links: { linkedin: "", github: "https://github.com/ada", website: "" },
      sections: [
        { id: "projects", visible: false, order: 0 },
      ],
      theme: { accentColor: "#112233" },
      contactVisibility: { email: true, phone: false },
      education: [{ school: "University", degree: "", field: "", startYear: "", endYear: "" }],
      experiences: [{
        company: "Analytical Engines",
        role: "",
        startDate: "",
        endDate: "",
        description: "",
        technologies: ["TypeScript"],
      }],
      projects: [{ name: "Engine", year: "", description: "", technologies: [] }],
      skills: { languages: [], frameworks: ["NestJS"], tools: [], databases: [], other: [] },
      languages: [{ name: "English", level: "" }],
      certifications: [{ name: "Certificate", issuer: "", year: "2025" }],
    })
  })

  it("removes unsupported skills, technologies and entities using accent-insensitive Unicode matching", () => {
    const data = normalize({
      education: [{ school: "Université de Montréal" }, { school: "Fake University" }],
      experiences: [{ company: "École Exemple", technologies: ["TypeScript", "InventedTool"] }],
      projects: [{ name: "Café App", technologies: ["React", "MadeUpJS"] }, { name: "Imaginary Project" }],
      skills: { frameworks: ["NestJS", "FakeFramework"], other: ["Sécurité"] },
    })

    const result = validateAgainstSource(
      data,
      "UNIVERSITE\u0301 DE MONTREAL. Ecole Exemple : typescript. Cafe\u0301 APP avec react. NestJS. Securite\u0301.",
    )

    expect(result.cleaned.education).toEqual([{ school: "Université de Montréal", degree: "", field: "", startYear: "", endYear: "" }])
    expect(result.cleaned.experiences).toEqual([{
      company: "École Exemple",
      role: "",
      startDate: "",
      endDate: "",
      description: "",
      technologies: ["TypeScript"],
    }])
    expect(result.cleaned.projects).toEqual([{ name: "Café App", year: "", description: "", technologies: ["React"] }])
    expect(result.cleaned.skills).toEqual({
      languages: [],
      frameworks: ["NestJS"],
      tools: [],
      databases: [],
      other: ["Sécurité"],
    })
    expect(result.removedItems).toEqual([
      { field: "education[1].school", value: "Fake University" },
      { field: "experiences[0].technologies[1]", value: "InventedTool" },
      { field: "projects[0].technologies[1]", value: "MadeUpJS" },
      { field: "projects[1].name", value: "Imaginary Project" },
      { field: "skills.frameworks[1]", value: "FakeFramework" },
    ])
  })
})
