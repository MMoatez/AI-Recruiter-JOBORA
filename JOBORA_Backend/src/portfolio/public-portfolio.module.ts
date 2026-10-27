import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { OllamaModule } from "../ollama/ollama.module"
import { ThrottlerModule } from "@nestjs/throttler"
import { Portfolio, PortfolioSchema } from "./portfolio.schema"
import { PortfolioService } from "./portfolio.service"
import { PublicPortfolioController } from "./public-portfolio.controller"

@Module({
  imports: [
    OllamaModule,
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 10 }]),
    MongooseModule.forFeature([{ name: Portfolio.name, schema: PortfolioSchema }]),
  ],
  controllers: [PublicPortfolioController],
  providers: [PortfolioService],
})
export class PublicPortfolioModule {}
