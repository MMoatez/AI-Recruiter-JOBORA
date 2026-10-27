import { Module } from "@nestjs/common"
import { ThrottlerModule } from "@nestjs/throttler"
import { DatabaseModule } from "../database/database.module"
import { OllamaModule } from "../ollama/ollama.module"
import { PortfolioService } from "./portfolio.service"
import { PublicPortfolioController } from "./public-portfolio.controller"

@Module({
  imports: [
    DatabaseModule,
    OllamaModule,
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 10 }]),
  ],
  controllers: [PublicPortfolioController],
  providers: [PortfolioService],
})
export class PublicPortfolioModule {}
