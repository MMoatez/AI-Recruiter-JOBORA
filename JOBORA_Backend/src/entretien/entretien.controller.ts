import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { memoryStorage } from "multer"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { AnalyzeOfferDto, AnswerDto, CreateSessionDto, MockInterviewDto } from "./dto/entretien.dto"
import { EntretienService } from "./entretien.service"

@Controller("entretien")
@UseGuards(JwtAuthGuard)
export class EntretienController {
  constructor(private readonly entretien: EntretienService) {}

  @Post("offre/analyse")
  analyze(@Body() dto: AnalyzeOfferDto) {
    return this.entretien.analyze(dto.offerText)
  }

  @Get("ai-health")
  aiHealth() {
    return this.entretien.aiHealth()
  }

  @Post("cv")
  @UseInterceptors(FileInterceptor("file", { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  parseCv(@UploadedFile() file: Express.Multer.File) {
    if (!file || file.mimetype !== "application/pdf") throw new BadRequestException("Importe un fichier PDF de 5 Mo maximum.")
    return this.entretien.parseCv(file)
  }

  @Post("sessions")
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateSessionDto) {
    return this.entretien.create(user.id, dto)
  }

  @Get("sessions")
  list(@CurrentUser() user: { id: string }) {
    return this.entretien.list(user.id)
  }

  @Get("sessions/:id")
  detail(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.entretien.detail(id, user.id)
  }

  @Post("sessions/:id/reponses")
  @HttpCode(200)
  answer(@CurrentUser() user: { id: string }, @Param("id") id: string, @Body() dto: AnswerDto) {
    return this.entretien.answer(id, user.id, dto)
  }

  @Post("sessions/:id/entretien-blanc")
  @HttpCode(200)
  mock(@CurrentUser() user: { id: string }, @Param("id") id: string, @Body() dto: MockInterviewDto) {
    return this.entretien.mock(id, user.id, dto)
  }
}
