import { ConfigModule, ConfigService } from "@nestjs/config"
import { Module } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { HttpModule, HttpService } from "@nestjs/axios"
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises"
import { basename, extname, resolve } from "node:path"
import { OllamaService } from "../src/ollama/ollama.service"
import type { PortfolioDataDto } from "../src/portfolio/portfolio.dto"
import { extractCvText, extractFromCv } from "../src/portfolio/portfolio-extraction"

type EvaluationResult = {
  file: string
  jsonValid: boolean
  removedItemsCount: number
  emptyFieldsCount: number | null
  durationMs: number
  error?: string
  data?: PortfolioDataDto
}

function countEmptyFields(value: unknown): number {
  if (typeof value === "string") return value.trim() ? 0 : 1
  if (value === null || value === undefined) return 1
  if (Array.isArray(value)) {
    return value.length === 0 ? 1 : value.reduce((count, item) => count + countEmptyFields(item), 0)
  }
  if (typeof value === "object") {
    return Object.values(value).reduce((count, item) => count + countEmptyFields(item), 0)
  }
  return 0
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, "..", ".env"),
    }),
    HttpModule,
  ],
  providers: [
    {
      provide: OllamaService,
      useFactory: (http: HttpService, config: ConfigService) => new OllamaService(http, config),
      inject: [HttpService, ConfigService],
    },
  ],
})
class PortfolioEvaluationModule {}

async function main(): Promise<void> {
  const inputDirectory = process.argv[2]
    ? resolve(process.cwd(), process.argv[2])
    : resolve(__dirname, "..", "..", "test-cvs")
  const entries = await readdir(inputDirectory, { withFileTypes: true })
  const pdfFiles = entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLocaleLowerCase() === ".pdf")
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right))

  if (pdfFiles.length === 0) {
    throw new Error(`Aucun fichier PDF trouvé dans le dossier : ${inputDirectory}`)
  }

  const outputDirectory = resolve(
    __dirname,
    "..",
    "..",
    "eval-output",
    new Date().toISOString().replace(/[:.]/g, "-"),
  )
  await mkdir(outputDirectory, { recursive: true })

  const app = await NestFactory.createApplicationContext(PortfolioEvaluationModule, { logger: ["error", "warn"] })
  const ollama = app.get(OllamaService)
  const results: EvaluationResult[] = []

  try {
    for (const file of pdfFiles) {
      const startedAt = performance.now()
      try {
        const buffer = await readFile(resolve(inputDirectory, file))
        const { text } = await extractCvText(buffer)
        const { cleaned, removedItems } = await extractFromCv(ollama, text)
        const result: EvaluationResult = {
          file,
          jsonValid: true,
          removedItemsCount: removedItems.length,
          emptyFieldsCount: countEmptyFields(cleaned),
          durationMs: Math.round(performance.now() - startedAt),
          data: cleaned,
        }
        results.push(result)
        await writeFile(resolve(outputDirectory, `${basename(file, extname(file))}.json`), `${JSON.stringify(result, null, 2)}\n`)
      } catch (error) {
        const result: EvaluationResult = {
          file,
          jsonValid: false,
          removedItemsCount: 0,
          emptyFieldsCount: null,
          durationMs: Math.round(performance.now() - startedAt),
          error: error instanceof Error ? error.message : String(error),
        }
        results.push(result)
        await writeFile(resolve(outputDirectory, `${basename(file, extname(file))}.json`), `${JSON.stringify(result, null, 2)}\n`)
      }
    }
  } finally {
    await app.close()
  }

  await writeFile(resolve(outputDirectory, "summary.json"), `${JSON.stringify(results, null, 2)}\n`)
  console.table(results.map(({ file, jsonValid, removedItemsCount, emptyFieldsCount, durationMs, error }) => ({
    CV: file,
    "JSON valide": jsonValid ? "oui" : "non",
    "Éléments supprimés": removedItemsCount,
    "Champs vides": emptyFieldsCount ?? "n/a",
    "Temps (ms)": durationMs,
    ...(error ? { Erreur: error } : {}),
  })))
  console.log(`Résultats sauvegardés dans ${outputDirectory}`)
}

main().catch((error: unknown) => {
  console.error("Échec de l’évaluation des portfolios :", error instanceof Error ? error.message : error)
  process.exitCode = 1
})
