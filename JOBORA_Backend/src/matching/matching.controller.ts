import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { memoryStorage } from "multer"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { AnalyzeMatchingDto } from "./dto/analyze-matching.dto"
import { MatchingService } from "./matching.service"

@Controller("matching")
@UseGuards(JwtAuthGuard)
export class MatchingController {
  constructor(private readonly matching: MatchingService) {}

  @Post("analyze")
  analyze(@CurrentUser() user: { id: string }, @Body() dto: AnalyzeMatchingDto) {
    return this.matching.analyze(user.id, dto)
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("file", {
    storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_request, file, callback) => file.mimetype === "application/pdf"
      ? callback(null, true)
      : callback(new BadRequestException("Seuls les fichiers PDF sont acceptés."), false),
  }))
  upload(@CurrentUser() user: { id: string }, @UploadedFile() file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("Choisis un fichier PDF valide de 5 Mo maximum.")
    return this.matching.importPdf(user.id, file)
  }
}
