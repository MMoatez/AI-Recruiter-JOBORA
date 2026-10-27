import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { AuthModule } from "../auth/auth.module"
import { OllamaModule } from "../ollama/ollama.module"
import { PortfolioController } from "./portfolio.controller"
import { Portfolio, PortfolioSchema } from "./portfolio.schema"
import { PortfolioService } from "./portfolio.service"
import { ThrottlerModule } from "@nestjs/throttler"

@Module({
  imports: [
    AuthModule,
    OllamaModule,
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 10 }]),
    MongooseModule.forFeature([{ name: Portfolio.name, schema: PortfolioSchema }]),
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
})
export class PortfolioModule {}
