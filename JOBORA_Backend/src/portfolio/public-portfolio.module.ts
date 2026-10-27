import { Module } from "@nestjs/common"
import { DatabaseModule } from "../database/database.module"
import { OllamaModule } from "../ollama/ollama.module"
import { PortfolioService } from "./portfolio.service"
import { PublicPortfolioController } from "./public-portfolio.controller"

@Module({
  imports: [DatabaseModule, OllamaModule],
  controllers: [PublicPortfolioController],
  providers: [PortfolioService],
})
export class PublicPortfolioModule {}
