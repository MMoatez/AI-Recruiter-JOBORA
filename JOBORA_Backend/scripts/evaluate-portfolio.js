"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("@nestjs/config");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const axios_1 = require("@nestjs/axios");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const config_2 = require("@nestjs/config");
const ollama_service_1 = require("../src/ollama/ollama.service");
const portfolio_extraction_1 = require("../src/portfolio/portfolio-extraction");
function countEmptyFields(value) {
    if (typeof value === "string")
        return value.trim() ? 0 : 1;
    if (value === null || value === undefined)
        return 1;
    if (Array.isArray(value)) {
        return value.length === 0 ? 1 : value.reduce((count, item) => count + countEmptyFields(item), 0);
    }
    if (typeof value === "object") {
        return Object.values(value).reduce((count, item) => count + countEmptyFields(item), 0);
    }
    return 0;
}
let PortfolioEvaluationModule = class PortfolioEvaluationModule {
};
PortfolioEvaluationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: (0, node_path_1.resolve)(__dirname, "..", ".env"),
            }),
            axios_1.HttpModule,
        ],
        providers: [
            {
                provide: ollama_service_1.OllamaService,
                useFactory: (http, config) => new ollama_service_1.OllamaService(http, config),
                inject: [axios_1.HttpService, config_2.ConfigService],
            },
        ],
    })
], PortfolioEvaluationModule);
async function main() {
    const inputDirectory = (0, node_path_1.resolve)(__dirname, "..", "..", process.argv[2] ?? "test-cvs");
    const entries = await (0, promises_1.readdir)(inputDirectory, { withFileTypes: true });
    const pdfFiles = entries
        .filter((entry) => entry.isFile() && (0, node_path_1.extname)(entry.name).toLocaleLowerCase() === ".pdf")
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
    if (pdfFiles.length === 0) {
        throw new Error(`Aucun fichier PDF trouvé dans le dossier : ${inputDirectory}`);
    }
    const outputDirectory = (0, node_path_1.resolve)(__dirname, "..", "..", "eval-output", new Date().toISOString().replace(/[:.]/g, "-"));
    await (0, promises_1.mkdir)(outputDirectory, { recursive: true });
    const app = await core_1.NestFactory.createApplicationContext(PortfolioEvaluationModule, { logger: ["error", "warn"] });
    const ollama = app.get(ollama_service_1.OllamaService);
    const results = [];
    try {
        for (const file of pdfFiles) {
            const startedAt = performance.now();
            try {
                const buffer = await (0, promises_1.readFile)((0, node_path_1.resolve)(inputDirectory, file));
                const { text } = await (0, portfolio_extraction_1.extractCvText)(buffer);
                const { cleaned, removedItems } = await (0, portfolio_extraction_1.extractFromCv)(ollama, text);
                const result = {
                    file,
                    jsonValid: true,
                    removedItemsCount: removedItems.length,
                    emptyFieldsCount: countEmptyFields(cleaned),
                    durationMs: Math.round(performance.now() - startedAt),
                    data: cleaned,
                };
                results.push(result);
                await (0, promises_1.writeFile)((0, node_path_1.resolve)(outputDirectory, `${(0, node_path_1.basename)(file, (0, node_path_1.extname)(file))}.json`), `${JSON.stringify(result, null, 2)}\n`);
            }
            catch (error) {
                const result = {
                    file,
                    jsonValid: false,
                    removedItemsCount: 0,
                    emptyFieldsCount: null,
                    durationMs: Math.round(performance.now() - startedAt),
                    error: error instanceof Error ? error.message : String(error),
                };
                results.push(result);
                await (0, promises_1.writeFile)((0, node_path_1.resolve)(outputDirectory, `${(0, node_path_1.basename)(file, (0, node_path_1.extname)(file))}.json`), `${JSON.stringify(result, null, 2)}\n`);
            }
        }
    }
    finally {
        await app.close();
    }
    await (0, promises_1.writeFile)((0, node_path_1.resolve)(outputDirectory, "summary.json"), `${JSON.stringify(results, null, 2)}\n`);
    console.table(results.map(({ file, jsonValid, removedItemsCount, emptyFieldsCount, durationMs, error }) => ({
        CV: file,
        "JSON valide": jsonValid ? "oui" : "non",
        "Éléments supprimés": removedItemsCount,
        "Champs vides": emptyFieldsCount ?? "n/a",
        "Temps (ms)": durationMs,
        ...(error ? { Erreur: error } : {}),
    })));
    console.log(`Résultats sauvegardés dans ${outputDirectory}`);
}
main().catch((error) => {
    console.error("Échec de l’évaluation des portfolios :", error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
//# sourceMappingURL=evaluate-portfolio.js.map