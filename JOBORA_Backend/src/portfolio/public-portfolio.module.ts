import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { OllamaModule } from "../ollama/ollama.module"
import { Portfolio, PortfolioSchema } from "./portfolio.schema"
import { PortfolioService } from "./portfolio.service"
import { PublicPortfolioController } from "./public-portfolio.controller"

@Module({
  imports: [OllamaModule, MongooseModule.forFeature([{ name: Portfolio.name, schema: PortfolioSchema }])],
  controllers: [PublicPortfolioController],
  providers: [PortfolioService],
})
export class PublicPortfolioModule {}
