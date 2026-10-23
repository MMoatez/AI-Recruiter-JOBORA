import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { GenerateLetterDto, RewriteParagraphDto, UpdateLetterDto } from "./dto/lettre.dto"
import { LettreService } from "./lettre.service"

type AuthUser = { id: string; name?: string; email?: string }

@Controller("lettres")
@UseGuards(JwtAuthGuard)
export class LettreController {
  constructor(private readonly lettres: LettreService) {}

  /** CV JOBORA disponibles comme source de la lettre. */
  @Get("cvs")
  cvOptions(@CurrentUser() user: AuthUser) {
    return this.lettres.cvOptions(user.id)
  }

  @Post()
  generate(@CurrentUser() user: AuthUser, @Body() dto: GenerateLetterDto) {
    return this.lettres.generate(user, dto)
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.lettres.list(user.id)
  }

  @Get(":id")
  detail(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.lettres.detail(id, user.id)
  }

  @Patch(":id")
  update(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body() dto: UpdateLetterDto) {
    return this.lettres.update(id, user.id, dto)
  }

  @Post(":id/paragraphes/:index/reecrire")
  rewrite(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Param("index", ParseIntPipe) index: number,
    @Body() dto: RewriteParagraphDto,
  ) {
    return this.lettres.rewrite(id, user.id, index, dto)
  }

  @Delete(":id")
  remove(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.lettres.remove(id, user.id)
  }
}
