import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { CvService } from "./cv.service"
import { CreateCvDto, RegenerateSectionDto, UpdateCvDto } from "./dto/cv.dto"
import { RagService } from "./rag.service"

@Controller("cvs")
@UseGuards(JwtAuthGuard)
export class CvController {
  constructor(private readonly cvs: CvService, private readonly rag: RagService) {}

  @Get("rag/status") ragStatus() { return this.rag.status() }

  @Get() list(@CurrentUser() user: { id: string }) { return this.cvs.list(user.id) }
  @Get(":id") get(@CurrentUser() user: { id: string }, @Param("id") id: string) { return this.cvs.get(user.id, id) }
  @Post() create(@CurrentUser() user: { id: string }, @Body() dto: CreateCvDto) { return this.cvs.create(user.id, dto) }
  @Patch(":id") update(@CurrentUser() user: { id: string }, @Param("id") id: string, @Body() dto: UpdateCvDto) { return this.cvs.update(user.id, id, dto) }
  @Delete(":id") remove(@CurrentUser() user: { id: string }, @Param("id") id: string) { return this.cvs.remove(user.id, id) }
  @Post(":id/generate") generate(@CurrentUser() user: { id: string }, @Param("id") id: string) { return this.cvs.generate(user.id, id) }
  @Post(":id/validate-ats") validate(@CurrentUser() user: { id: string }, @Param("id") id: string) { return this.cvs.validate(user.id, id) }
  @Post(":id/regenerate-section") regenerateSection(@CurrentUser() user: { id: string }, @Param("id") id: string, @Body() dto: RegenerateSectionDto) {
    return this.cvs.regenerateSection(user.id, id, dto)
  }
}
