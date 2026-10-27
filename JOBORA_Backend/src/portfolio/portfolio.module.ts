import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { DatabaseModule } from "../database/database.module"
import { OllamaModule } from "../ollama/ollama.module"
import { PortfolioController } from "./portfolio.controller"
import { PortfolioService } from "./portfolio.service"
import { ThrottlerModule } from "@nestjs/throttler"

@Module({
  imports: [AuthModule, DatabaseModule, OllamaModule, ThrottlerModule],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
