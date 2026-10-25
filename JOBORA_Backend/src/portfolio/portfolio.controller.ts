import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  StreamableFile,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { Throttle, ThrottlerGuard } from "@nestjs/throttler"
import { memoryStorage } from "multer"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { ExtractPortfolioDto } from "./extract-portfolio.dto"
import { PortfolioDataDto } from "./portfolio.dto"
import { RankProjectsDto } from "./rank-projects.dto"
import { PortfolioService } from "./portfolio.service"
import { PortfolioTemplateDto } from "./portfolio-template.dto"
import { portfolioCvDisposition } from "./portfolio-download"

const MAX_FILE_SIZE = 5 * 1024 * 1024
const pdfUploadInterceptor = () => FileInterceptor("file", {
  storage: memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_request, file, callback) => {
    if (file.mimetype !== "application/pdf") {
      callback(new BadRequestException("Seuls les fichiers PDF (application/pdf) sont acceptés."), false)
      return
    }
    callback(null, true)
  },
})

@Controller("portfolio")
@UseGuards(JwtAuthGuard)
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Post("generate")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(pdfUploadInterceptor())
  generate(
    @CurrentUser() user: { id: string },
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) throw new BadRequestException("Veuillez envoyer un fichier PDF dans le champ « file ».")
    return this.portfolio.generate(user.id, file)
  }

  @Get("me")
  getMine(@CurrentUser() user: { id: string }) {
    return this.portfolio.getMine(user.id)
  }

  @Put("me")
  updateMine(@CurrentUser() user: { id: string }, @Body() dto: PortfolioDataDto) {
    return this.portfolio.updateMine(user.id, dto)
  }

  @Patch("me/template")
  updateTemplate(@CurrentUser() user: { id: string }, @Body() dto: PortfolioTemplateDto) {
    return this.portfolio.updateTemplate(user.id, dto.templateId)
  }

  @Post("me/regenerate-about")
  regenerateAbout(@CurrentUser() user: { id: string }) {
    return this.portfolio.regenerateAbout(user.id)
  }

  @Post("me/publish")
  publish(@CurrentUser() user: { id: string }) {
    return this.portfolio.publish(user.id)
  }

  @Post("me/unpublish")
  unpublish(@CurrentUser() user: { id: string }) {
    return this.portfolio.unpublish(user.id)
  }

  @Post("me/sync")
  sync(@CurrentUser() user: { id: string }) {
    return this.portfolio.sync(user.id)
  }

  @Get("me/cv")
  async downloadMineCv(@CurrentUser() user: { id: string }) {
    const { buffer, filename } = await this.portfolio.getMineCv(user.id)
    return new StreamableFile(buffer, {
      type: "application/pdf",
      disposition: portfolioCvDisposition(filename),
    })
  }

  @Post("me/rank-projects")
  rankProjects(@CurrentUser() user: { id: string }, @Body() dto: RankProjectsDto) {
    return this.portfolio.rankMineProjects(user.id, dto.jobText)
  }

  @Delete("me")
  deleteMine(@CurrentUser() user: { id: string }) {
    return this.portfolio.deleteMine(user.id)
  }

  @Post("extract-cv")
  extractCv(@Body() dto: ExtractPortfolioDto) {
    return this.portfolio.extractFromCv(dto.cvText)
  }

  @Post("upload-cv")
  @UseInterceptors(pdfUploadInterceptor())
  uploadCv(@UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("Veuillez envoyer un fichier PDF dans le champ « file ».")
    return this.portfolio.extractCvText(file.buffer)
  }

}
