import { BadRequestException } from "@nestjs/common"
import pdfParse = require("pdf-parse")
import { OllamaService } from "../ollama/ollama.service"
import { emptyPortfolioData, PortfolioData } from "./portfolio-data"
import { PORTFOLIO_GENERATION_PROMPTS, PORTFOLIO_SYSTEM_PROMPTS } from "./portfolio.prompts"
import { PortfolioService } from "./portfolio.service"
import { portfolioCvDisposition } from "./portfolio-download"
import { DatabaseService } from "../database/database.service"

jest.mock("pdf-parse", () => jest.fn())

describe("PortfolioService", () => {
  const parsePdf = jest.mocked(pdfParse)
  const ollama = { generateJson: jest.fn(), embed: jest.fn() }
  const savedPortfolio = { _id: "portfolio-id", userId: "user-id" }
  const portfolios = {
    findOneAndUpdate: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn(),
  }
  let database: DatabaseService
  let service: PortfolioService

  beforeEach(() => {
    parsePdf.mockReset()
    ollama.generateJson.mockReset()
    ollama.embed.mockReset()
    portfolios.findOneAndUpdate.mockReset().mockReturnValue({ exec: jest.fn().mockResolvedValue(savedPortfolio) })
    portfolios.findOne.mockReset().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(savedPortfolio),
    })
    portfolios.deleteOne.mockReset().mockReturnValue({ exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) })
    process.env.SQLITE_PATH = ":memory:"
    database = new DatabaseService()
    service = new PortfolioService(database, ollama as unknown as OllamaService)
  })

  afterEach(() => database.onModuleDestroy())

  afterEach(() => database?.onModuleDestroy())

  it("generates a headline from title and skills at temperature 0.3 and enforces its word count", async () => {
    const data = { ...emptyPortfolioData(), title: "Développeuse", skills: { ...emptyPortfolioData().skills, frameworks: ["NestJS"] } }
    const headline = "Développeuse spécialisée en NestJS et technologies web modernes"
    ollama.generateJson.mockResolvedValue({ headline })

    await expect(service.generateHeadline(data)).resolves.toBe(headline)
    expect(ollama.generateJson).toHaveBeenCalledWith(
      PORTFOLIO_GENERATION_PROMPTS.headline,
      JSON.stringify({ title: data.title, skills: data.skills }),
      0.3,
    )

    ollama.generateJson.mockResolvedValue({ headline: "Développeuse NestJS" })
    await expect(service.generateHeadline(data)).rejects.toThrow("L’accroche portfolio doit contenir entre 8 et 12 mots.")
  })

  it("extracts and cleans the PDF text", async () => {
    const buffer = Buffer.from("pdf data")
    const rawText = `  Profile   summary\u2022 Experience\r\n\r\n\r\n${"A".repeat(100)}  `
    parsePdf.mockResolvedValue({ text: rawText } as Awaited<ReturnType<typeof pdfParse>>)

    const result = await service.extractCvText(buffer)

    expect(parsePdf).toHaveBeenCalledWith(buffer)
    expect(result.text).toBe(`Profile summary- Experience\n\n${"A".repeat(100)}`)
    expect(result.length).toBe(result.text.length)
  })

  it("rejects extracted text shorter than 100 characters as probably scanned", async () => {
    parsePdf.mockResolvedValue({ text: "Only a little text." } as Awaited<ReturnType<typeof pdfParse>>)

    await expect(service.extractCvText(Buffer.from("pdf data"))).rejects.toThrow(
      new BadRequestException(
        "Le PDF contient moins de 100 caractères de texte exploitable. Il est probablement scanné ; utilisez un PDF avec du texte sélectionnable.",
      ),
    )
  })

  it("rejects a PDF that contains no extracted text", async () => {
    parsePdf.mockResolvedValue({ text: "" } as Awaited<ReturnType<typeof pdfParse>>)

    await expect(service.extractCvText(Buffer.from("%PDF-empty"))).rejects.toThrow(BadRequestException)
  })

  it("returns a clear error when the PDF cannot be parsed", async () => {
    parsePdf.mockRejectedValue(new Error("invalid PDF"))

    const error = await service.extractCvText(Buffer.from("not a PDF")).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(BadRequestException)
    if (error instanceof BadRequestException) {
      expect(error.getResponse()).toMatchObject({
        message: "Le PDF n’a pas pu être lu. Vérifiez que le fichier est valide.",
      })
    }
  })

  it("extracts all portfolio sections sequentially, normalizes and validates them", async () => {
    const cvText = "Ada Lovelace Engineer ada@example.com University of London Example Ltd NestJS Engine TypeScript English Fluent Cloud Example 2024"
    ollama.generateJson
      .mockResolvedValueOnce({
        fullName: "Ada Lovelace",
        title: "Engineer",
        email: "ada@example.com",
        education: [{ school: "University of London" }],
      })
      .mockResolvedValueOnce({ experiences: [{ company: "Example Ltd", technologies: ["NestJS"] }] })
      .mockResolvedValueOnce({ projects: [{ name: "Engine" }] })
      .mockResolvedValueOnce({
        skills: { languages: ["TypeScript"] },
        languages: [{ name: "English", level: "Fluent" }],
        certifications: [{ name: "Cloud", issuer: "Example", year: "2024" }],
      })

    const result = await service.extractFromCv(cvText)

    expect(ollama.generateJson.mock.calls).toEqual([
      [PORTFOLIO_SYSTEM_PROMPTS.identity, cvText],
      [PORTFOLIO_SYSTEM_PROMPTS.experiences, cvText],
      [PORTFOLIO_SYSTEM_PROMPTS.projects, cvText],
      [PORTFOLIO_SYSTEM_PROMPTS.skills, cvText],
    ])
    expect(result.cleaned).toEqual({
      ...emptyPortfolioData(),
      fullName: "Ada Lovelace",
      title: "Engineer",
      email: "ada@example.com",
      education: [{ school: "University of London", degree: "", field: "", startYear: "", endYear: "" }],
      experiences: [{
        company: "Example Ltd",
        role: "",
        startDate: "",
        endDate: "",
        description: "",
        technologies: ["NestJS"],
      }],
      projects: [{ name: "Engine", year: "", description: "", technologies: [] }],
      skills: { languages: ["TypeScript"], frameworks: [], tools: [], databases: [], other: [] },
      languages: [{ name: "English", level: "Fluent" }],
      certifications: [{ name: "Cloud", issuer: "Example", year: "2024" }],
    })
    expect(result.removedItems).toEqual([])
  })

  it("rejects extracted portfolio data that fails DTO validation", async () => {
    ollama.generateJson
      .mockResolvedValueOnce({ email: "not-an-email" })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})

    await expect(service.extractFromCv("CV text")).rejects.toThrow(
      "Les données extraites du CV ne respectent pas le schéma portfolio.",
    )
  })

  it("stops at the first failed Ollama call", async () => {
    ollama.generateJson.mockRejectedValue(new Error("Ollama unavailable"))

    await expect(service.extractFromCv("CV text")).rejects.toThrow("Ollama unavailable")
    expect(ollama.generateJson).toHaveBeenCalledTimes(1)
  })

  it("generates an about paragraph in French at temperature 0.3", async () => {
    const data = emptyPortfolioData()
    data.education.push({ school: "Université Exemple", degree: "Licence", field: "Informatique", startYear: "", endYear: "" })
    data.skills.frameworks.push("NestJS")
    data.projects.push({ name: "Portfolio", year: "", description: "Site personnel", technologies: ["React"] })
    ollama.generateJson.mockResolvedValue({ about: "J’ai étudié l’informatique. Je connais NestJS. J’ai créé un portfolio avec React." })

    const result = await service.generateAbout(data)

    expect(result).toBe("J’ai étudié l’informatique. Je connais NestJS. J’ai créé un portfolio avec React.")
    expect(ollama.generateJson).toHaveBeenCalledWith(
      PORTFOLIO_GENERATION_PROMPTS.about,
      JSON.stringify({ education: data.education, skills: data.skills, projects: data.projects }),
      0.3,
    )
    expect(PORTFOLIO_GENERATION_PROMPTS.about).toContain("Réponds toujours en français")
  })

  it("enhances project descriptions and keeps the original when technologies change", async () => {
    const data: PortfolioData = {
      ...emptyPortfolioData(),
      projects: [
        { name: "Site météo", year: "2024", description: "Site de météo", technologies: ["React", "TypeScript"] },
        { name: "Portfolio", year: "", description: "Site personnel", technologies: ["NestJS"] },
      ],
    }
    ollama.generateJson
      .mockResolvedValueOnce({
        description: "J’ai conçu une application météo avec React et TypeScript.",
        technologies: ["React", "TypeScript"],
      })
      .mockResolvedValueOnce({
        description: "Un portfolio moderne développé avec NestJS et MongoDB.",
        technologies: ["NestJS", "MongoDB"],
      })

    const result = await service.enhanceProjects(data)

    expect(result.projects).toEqual([
      { ...data.projects[0], description: "J’ai conçu une application météo avec React et TypeScript." },
      data.projects[1],
    ])
    expect(data.projects[0].description).toBe("Site de météo")
    expect(ollama.generateJson).toHaveBeenNthCalledWith(
      1,
      PORTFOLIO_GENERATION_PROMPTS.project,
      JSON.stringify(data.projects[0]),
    )
    expect(PORTFOLIO_GENERATION_PROMPTS.project).toContain("Réponds toujours en français")
  })

  it("preserves original project descriptions when Ollama returns an invalid technology list", async () => {
    const data = {
      ...emptyPortfolioData(),
      projects: [{ name: "Application", year: "", description: "Description source", technologies: ["TypeScript"] }],
    }
    ollama.generateJson.mockResolvedValue({ description: "Nouvelle description.", technologies: "TypeScript" })

    await expect(service.enhanceProjects(data)).resolves.toEqual(data)
  })

  it("upserts the generated portfolio using only the authenticated user id", async () => {
    const cvText = "Ada Lovelace ada@example.com University of London Example Ltd TypeScript. Additional portfolio source text for testing the PDF extraction flow."
    parsePdf.mockResolvedValue({ text: cvText } as Awaited<ReturnType<typeof pdfParse>>)
    ollama.generateJson
      .mockResolvedValueOnce({ fullName: "Ada Lovelace", email: "ada@example.com", education: [{ school: "University of London" }] })
      .mockResolvedValueOnce({ experiences: [{ company: "Example Ltd" }] })
      .mockResolvedValueOnce({ projects: [] })
      .mockResolvedValueOnce({ skills: { languages: ["TypeScript"] } })
      .mockResolvedValueOnce({ headline: "Développeuse spécialisée en TypeScript et technologies web modernes" })
      .mockResolvedValueOnce({ about: "J’ai étudié à University of London. Je connais TypeScript. J’ai travaillé chez Example Ltd." })

    await service.generate("user-id", {
      buffer: Buffer.from("pdf"),
      originalname: "cv.pdf",
    } as Express.Multer.File)

    expect(portfolios.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-id" },
      expect.objectContaining({
        $set: expect.objectContaining({
          sourceCvName: "cv.pdf",
          sourceCvText: cvText,
          removedItems: [],
          data: expect.objectContaining({
            fullName: "Ada Lovelace",
            headline: "Développeuse spécialisée en TypeScript et technologies web modernes",
            about: "J’ai étudié à University of London. Je connais TypeScript. J’ai travaillé chez Example Ltd.",
          }),
          lastSyncedAt: expect.any(Date),
        }),
        $setOnInsert: { userId: "user-id" },
      }),
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    )
    expect(ollama.generateJson).toHaveBeenCalledTimes(6)
  })

  it("syncs only extracted portfolio lists from the stored source CV", async () => {
    const sourceCvText = "Nouvelle université Nouvelle entreprise Nouveau projet NestJS Nouvelle certification"
    const current = { sourceCvText }
    const findQuery = {
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(current),
    }
    portfolios.findOne.mockReturnValue(findQuery)
    ollama.generateJson
      .mockResolvedValueOnce({ education: [{ school: "Nouvelle université" }] })
      .mockResolvedValueOnce({ experiences: [{ company: "Nouvelle entreprise" }] })
      .mockResolvedValueOnce({ projects: [{ name: "Nouveau projet" }] })
      .mockResolvedValueOnce({
        skills: { frameworks: ["NestJS"] },
        certifications: [{ name: "Nouvelle certification" }],
      })
    const updatedPortfolio = { _id: "portfolio-id", userId: "user-id" }
    portfolios.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updatedPortfolio) })

    await expect(service.sync("user-id")).resolves.toBe(updatedPortfolio)

    expect(findQuery.select).toHaveBeenCalledWith("+sourceCvText")
    expect(portfolios.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-id" },
      {
        $set: {
          "data.education": expect.arrayContaining([expect.objectContaining({ school: "Nouvelle université" })]),
          "data.experiences": expect.arrayContaining([expect.objectContaining({ company: "Nouvelle entreprise" })]),
          "data.projects": expect.arrayContaining([expect.objectContaining({ name: "Nouveau projet" })]),
          "data.skills": expect.objectContaining({ frameworks: ["NestJS"] }),
          "data.certifications": expect.arrayContaining([expect.objectContaining({ name: "Nouvelle certification" })]),
          removedItems: [],
          lastSyncedAt: expect.any(Date),
        },
      },
      { new: true, runValidators: true },
    )
    const update = portfolios.findOneAndUpdate.mock.calls[0]?.[1] as {
      $set: Record<string, unknown>
    }
    expect(Object.keys(update.$set).sort()).toEqual([
      "data.certifications",
      "data.education",
      "data.experiences",
      "data.projects",
      "data.skills",
      "lastSyncedAt",
      "removedItems",
    ])
    expect(update.$set).not.toHaveProperty("data.headline")
    expect(update.$set).not.toHaveProperty("data.about")
    expect(update.$set).not.toHaveProperty("data.theme")
    expect(update.$set).not.toHaveProperty("data.sections")
    expect(update.$set).not.toHaveProperty("templateId")
    expect(update.$set.lastSyncedAt).toBeInstanceOf(Date)
  })

  it("rejects synchronization clearly when no source CV is stored", async () => {
    const findQuery = {
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({ sourceCvText: "" }),
    }
    portfolios.findOne.mockReturnValue(findQuery)

    await expect(service.sync("user-id")).rejects.toThrow(
      "Aucun texte de CV source n’est enregistré pour ce portfolio. Importez de nouveau le CV avant de synchroniser.",
    )
    expect(portfolios.findOneAndUpdate).not.toHaveBeenCalled()
    expect(ollama.generateJson).not.toHaveBeenCalled()
  })

  it("stores and retrieves source CV PDFs as SQLite blobs", async () => {
    const text = "Ada Lovelace ada@example.com University of London Example Ltd TypeScript. Additional portfolio source text for testing the PDF extraction flow."
    parsePdf.mockResolvedValue({ text } as Awaited<ReturnType<typeof pdfParse>>)
    ollama.generateJson
      .mockResolvedValueOnce({ fullName: "Ada Lovelace", email: "ada@example.com" })
      .mockResolvedValueOnce({ experiences: [] })
      .mockResolvedValueOnce({ projects: [] })
      .mockResolvedValueOnce({ skills: {} })
      .mockResolvedValueOnce({ headline: "Développeuse spécialisée en TypeScript et technologies web modernes" })
      .mockResolvedValueOnce({ about: "Je développe des applications fiables et accessibles." })
    const bytes = Buffer.from("%PDF-source")
    await service.generate("user-id", { buffer: bytes, originalname: "cv.pdf" } as Express.Multer.File)
    await expect(service.getMineCv("user-id")).resolves.toEqual({ buffer: bytes, filename: "cv.pdf" })
  })

  it("creates a safe attachment disposition for CV filenames", () => {
    expect(portfolioCvDisposition("..\\private\r\nname é.pdf")).toBe(
      "attachment; filename=\"private__name _.pdf\"; filename*=UTF-8''private__name%20%C3%A9.pdf",
    )
  })

  it("scopes portfolio reads, updates, template changes and deletes to the authenticated user", async () => {
    const updateQuery = { exec: jest.fn().mockResolvedValue(savedPortfolio) }
    const readQuery = {
      select: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(savedPortfolio),
    }
    const deleteQuery = { exec: jest.fn().mockResolvedValue({ deletedCount: 1 }) }
    portfolios.findOneAndUpdate.mockReturnValue(updateQuery)
    portfolios.findOne.mockReturnValue(readQuery)
    portfolios.deleteOne.mockReturnValue(deleteQuery)

    await service.getMine("user-id")
    expect(portfolios.findOne).toHaveBeenCalledWith({ userId: "user-id" })

    await service.updateMine("user-id", emptyPortfolioData())
    expect(portfolios.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-id" },
      expect.objectContaining({ $setOnInsert: { userId: "user-id" } }),
      expect.objectContaining({ upsert: true }),
    )

    await service.updateTemplate("user-id", "developer")
    expect(portfolios.findOneAndUpdate).toHaveBeenLastCalledWith(
      { userId: "user-id" },
      { $set: { templateId: "developer" }, $setOnInsert: { userId: "user-id" } },
      expect.objectContaining({ upsert: true }),
    )

    await service.deleteMine("user-id")
    expect(portfolios.deleteOne).toHaveBeenCalledWith({ userId: "user-id" })
  })

  it("does not return another user's missing portfolio", async () => {
    portfolios.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) })

    await expect(service.getMine("other-user")).rejects.toThrow("Portfolio introuvable.")
    expect(portfolios.findOne).toHaveBeenCalledWith({ userId: "other-user" })
  })

  it("publishes with a normalized slug and retries collisions with a random suffix", async () => {
    portfolios.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({
      slug: undefined,
      data: { fullName: "Fatma B." },
    }) })
    portfolios.findOneAndUpdate
      .mockReturnValueOnce({ exec: jest.fn().mockRejectedValue({ code: 11000 }) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(savedPortfolio) })

    await service.publish("user-id")

    expect(portfolios.findOne).toHaveBeenCalledWith({ userId: "user-id" })
    expect(portfolios.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { userId: "user-id" },
      { $set: { slug: "fatma-b", status: "published", publishedAt: expect.any(Date) } },
      { new: true, runValidators: true },
    )
    const retrySlug = portfolios.findOneAndUpdate.mock.calls[1][1].$set.slug
    expect(retrySlug).toMatch(/^fatma-b-[a-f0-9]{6}$/)
  })

  it("unpublishes only the authenticated user's portfolio", async () => {
    await service.unpublish("user-id")

    expect(portfolios.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-id" },
      { $set: { status: "draft", publishedAt: null } },
      { new: true, runValidators: true },
    )
  })

  it("returns only published public fields and hides contacts unless explicitly visible", async () => {
    const publicData = {
      ...emptyPortfolioData(),
      fullName: "Fatma B.",
      email: "private@example.com",
      phone: "+111111111",
      contactVisibility: { email: false, phone: true },
    }
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        slug: "fatma-b",
        status: "published",
        templateId: "developer",
        publishedAt: new Date("2026-10-24T00:00:00.000Z"),
        userId: "secret-user-id",
        removedItems: ["secret"],
        data: publicData,
      }),
    }
    portfolios.findOne.mockReturnValue(query)

    const result = await service.getPublished("fatma-b")

    expect(portfolios.findOne).toHaveBeenCalledWith({ slug: "fatma-b", status: "published" })
    expect(query.select).toHaveBeenCalledWith({
      _id: 0,
      data: 1,
      templateId: 1,
      slug: 1,
      status: 1,
      publishedAt: 1,
    })
    expect(result).toEqual({
      slug: "fatma-b",
      templateId: "developer",
      status: "published",
      publishedAt: new Date("2026-10-24T00:00:00.000Z"),
      data: expect.objectContaining({
        fullName: "Fatma B.",
        phone: "+111111111",
      }),
    })
    expect(JSON.stringify(result)).not.toContain("userId")
    expect(JSON.stringify(result)).not.toContain("removedItems")
    expect(JSON.stringify(result)).not.toContain("private@example.com")
    expect(JSON.stringify(result)).not.toContain("contactVisibility")
  })

  it("does not expose an unpublished portfolio by slug", async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    }
    portfolios.findOne.mockReturnValue(query)

    await expect(service.getPublished("draft-slug")).rejects.toThrow("Portfolio public introuvable.")
    expect(portfolios.findOne).toHaveBeenCalledWith({ slug: "draft-slug", status: "published" })
  })

  it("includes email only when email visibility is enabled", async () => {
    const query = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue({
        slug: "fatma-b",
        templateId: "developer",
        publishedAt: new Date("2026-10-24T00:00:00.000Z"),
        data: {
          ...emptyPortfolioData(),
          email: "public@example.com",
          phone: "+111111111",
          contactVisibility: { email: true, phone: false },
        },
      }),
    }
    portfolios.findOne.mockReturnValue(query)

    const result = await service.getPublished("fatma-b")

    expect(result.data).toHaveProperty("email", "public@example.com")
    expect(result.data).not.toHaveProperty("phone")
  })

  it("ranks projects by descending cosine similarity and includes each score", async () => {
    const projects = [
      { name: "Low match", year: "", description: "Unrelated", technologies: ["CSS"] },
      { name: "Best match", year: "", description: "Backend API", technologies: ["NestJS"] },
      { name: "Partial match", year: "", description: "API", technologies: ["TypeScript"] },
    ]
    ollama.embed.mockResolvedValue([
      [0, 1],
      [1, 0],
      [0.8, 0.6],
      [1, 0],
    ])

    const result = await service.rankProjects(projects, "Backend NestJS")

    expect(ollama.embed).toHaveBeenCalledWith([
      "Low match\nUnrelated\nCSS",
      "Best match\nBackend API\nNestJS",
      "Partial match\nAPI\nTypeScript",
      "Backend NestJS",
    ])
    expect(result.map(({ project }) => project.name)).toEqual(["Best match", "Partial match", "Low match"])
    expect(result.map(({ score }) => score)).toEqual([1, 0.8, 0])
  })

  it.each([
    ["identical vectors", [1, 0], [1, 0], 1],
    ["orthogonal vectors", [1, 0], [0, 1], 0],
    ["opposite vectors", [1, 0], [-1, 0], -1],
  ])("computes cosine similarity for %s", async (_description, projectVector, jobVector, expectedScore) => {
    ollama.embed.mockResolvedValue([projectVector, jobVector])
    const project = { name: "Project", year: "", description: "", technologies: [] }

    const result = await service.rankProjects([project], "Job")

    expect(result).toEqual([{ project, score: expectedScore }])
  })

  it("persists the ranked project order only for the authenticated user", async () => {
    const projects = [
      { name: "Old first", year: "", description: "", technologies: [] },
      { name: "New first", year: "", description: "", technologies: [] },
    ]
    portfolios.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue({ data: { projects } }) })
    ollama.embed.mockResolvedValue([[0, 1], [1, 0], [1, 0]])
    const updatedPortfolio = { data: { projects: [projects[1], projects[0]] } }
    portfolios.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(updatedPortfolio) })

    const result = await service.rankMineProjects("user-id", "Job")

    expect(portfolios.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-id" },
      { $set: { "data.projects": [projects[1], projects[0]] } },
      { new: true, runValidators: true },
    )
    expect(result).toEqual({
      portfolio: updatedPortfolio,
      scores: [
        { projectName: "New first", score: 1 },
        { projectName: "Old first", score: 0 },
      ],
    })
  })
})
