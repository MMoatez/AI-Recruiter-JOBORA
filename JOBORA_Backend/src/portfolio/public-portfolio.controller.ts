import { Controller, Get, Param, StreamableFile, UseGuards } from "@nestjs/common"
import { Throttle, ThrottlerGuard } from "@nestjs/throttler"
import { PortfolioService } from "./portfolio.service"
import { portfolioCvDisposition } from "./portfolio-download"

@Controller("public/portfolio")
export class PublicPortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get(":slug")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  getPublished(@Param("slug") slug: string) {
    return this.portfolio.getPublished(slug)
  }

  @Get(":slug/cv")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async downloadPublishedCv(@Param("slug") slug: string) {
    const { buffer, filename } = await this.portfolio.getPublishedCv(slug)
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: portfolioCvDisposition(filename),
    })
  }
}
