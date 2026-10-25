import { BadGatewayException, BadRequestException, Logger } from "@nestjs/common"
import { plainToInstance } from "class-transformer"
import { validate } from "class-validator"
import pdfParse = require("pdf-parse")
import { OllamaService } from "../ollama/ollama.service"
import { PortfolioDataDto } from "./portfolio.dto"
import { normalize, PortfolioDataPartial, validateAgainstSource } from "./portfolio-data"
import { PORTFOLIO_SYSTEM_PROMPTS } from "./portfolio.prompts"

const logger = new Logger("PortfolioExtraction")

export async function extractCvText(buffer: Buffer): Promise<{ text: string; length: number }> {
  let extractedText: string
  try {
    const parsedPdf = await pdfParse(buffer)
    extractedText = parsedPdf.text
  } catch (error) {
    throw new BadRequestException("Le PDF n’a pas pu être lu. Vérifiez que le fichier est valide.", { cause: error })
  }

  const text = extractedText
    .replace(/\r\n?/g, "\n")
    .replace(/[\u2022\u25cf\u25e6\u25aa\u25a0\u2043\u2219\uf0b7]/g, "- ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

  if (text.length < 100) {
    throw new BadRequestException(
      "Le PDF contient moins de 100 caractères de texte exploitable. Il est probablement scanné ; utilisez un PDF avec du texte sélectionnable.",
    )
  }

  return { text, length: text.length }
}

export async function extractFromCv(
  ollama: OllamaService,
  cvText: string,
): Promise<{ cleaned: PortfolioDataDto; removedItems: { field: string; value: string }[] }> {
  const identity = await extractSection(ollama, "identity", PORTFOLIO_SYSTEM_PROMPTS.identity, cvText)
  const experiences = await extractSection(ollama, "experiences", PORTFOLIO_SYSTEM_PROMPTS.experiences, cvText)
  const projects = await extractSection(ollama, "projects", PORTFOLIO_SYSTEM_PROMPTS.projects, cvText)
  const skills = await extractSection(ollama, "skills", PORTFOLIO_SYSTEM_PROMPTS.skills, cvText)
  const extracted = { ...identity, ...experiences, ...projects, ...skills }

  assertArrayFields(extracted)
  const portfolio = plainToInstance(PortfolioDataDto, normalize(extracted as PortfolioDataPartial))
  const errors = await validate(portfolio, { whitelist: true, forbidNonWhitelisted: true })
  if (errors.length) {
    const details = errors
      .map((error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(", ")}`)
      .join("; ")
    throw new BadGatewayException(`Les données extraites du CV ne respectent pas le schéma portfolio. ${details}`)
  }

  const { cleaned, removedItems } = validateAgainstSource(portfolio, cvText)
  return { cleaned: plainToInstance(PortfolioDataDto, cleaned), removedItems }
}

async function extractSection(
  ollama: OllamaService,
  section: keyof typeof PORTFOLIO_SYSTEM_PROMPTS,
  systemPrompt: string,
  cvText: string,
): Promise<Record<string, unknown>> {
  const startedAt = Date.now()
  try {
    const result = await ollama.generateJson(systemPrompt, cvText)
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new BadGatewayException(`Ollama a retourné un objet invalide pour la section ${section}.`)
    }
    logger.log(`Extraction portfolio ${section} terminée en ${Date.now() - startedAt} ms.`)
    return result as Record<string, unknown>
  } catch (error) {
    logger.error(`Échec de l’extraction portfolio ${section} après ${Date.now() - startedAt} ms.`)
    throw error
  }
}

function assertArrayFields(data: Record<string, unknown>): void {
  const arrayFields = ["education", "experiences", "projects", "languages", "certifications"]
  for (const field of arrayFields) {
    if (data[field] !== undefined && !Array.isArray(data[field])) {
      throw new BadGatewayException(`Ollama a retourné un champ ${field} invalide : un tableau est attendu.`)
    }
  }

  for (const [field, value] of [["links", data.links], ["skills", data.skills]] as const) {
    if (value !== undefined && (!value || typeof value !== "object" || Array.isArray(value))) {
      throw new BadGatewayException(`Ollama a retourné un champ ${field} invalide : un objet est attendu.`)
    }
  }

  const skills = data.skills as Record<string, unknown> | undefined
  for (const field of ["languages", "frameworks", "tools", "databases", "other"]) {
    if (skills?.[field] !== undefined && !Array.isArray(skills[field])) {
      throw new BadGatewayException(`Ollama a retourné le champ skills.${field} invalide : un tableau est attendu.`)
    }
  }

  for (const [collection, fields] of [
    ["education", ["school", "degree", "field", "startYear", "endYear"]],
    ["experiences", ["company", "role", "startDate", "endDate", "description", "technologies"]],
    ["projects", ["name", "year", "description", "technologies"]],
    ["languages", ["name", "level"]],
    ["certifications", ["name", "issuer", "year"]],
  ] as const) {
    const entries = data[collection] as unknown[] | undefined
    if (!entries) continue
    for (const entry of entries) {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
        throw new BadGatewayException(`Ollama a retourné un élément invalide dans ${collection}.`)
      }
      for (const field of fields) {
        const value = (entry as Record<string, unknown>)[field]
        if (field === "technologies" && value !== undefined && !Array.isArray(value)) {
          throw new BadGatewayException(`Ollama a retourné un champ ${collection}.${field} invalide : un tableau est attendu.`)
        }
      }
    }
  }
}
