import { Module } from "@nestjs/common"
import { ThrottlerModule } from "@nestjs/throttler"
import { AuthModule } from "../auth/auth.module"
import { DatabaseModule } from "../database/database.module"
import { OllamaModule } from "../ollama/ollama.module"
import { PortfolioController } from "./portfolio.controller"
import { PortfolioService } from "./portfolio.service"

@Module({
  imports: [
    AuthModule,
    DatabaseModule,
    OllamaModule,
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 10 }]),
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
