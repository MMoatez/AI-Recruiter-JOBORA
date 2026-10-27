import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { CreateJobDto, CreateMatchDto, SaveProfileDto, SelectCvDto } from "./dto/job-matcher.dto"
import { JobMatcherService } from "./job-matcher.service"

@Controller("job-matcher")
@UseGuards(JwtAuthGuard)
export class JobMatcherController {
  constructor(private readonly matcher: JobMatcherService) {}

  @Post("cv")
  buildProfile(@CurrentUser() user: { id: string }, @Body() dto: SelectCvDto) {
    return this.matcher.buildProfile(user.id, dto.cvId)
  }

  @Get("profile/:cvId")
  getProfile(@CurrentUser() user: { id: string }, @Param("cvId") cvId: string) {
    return this.matcher.getProfile(user.id, cvId)
  }

  @Put("profile/:cvId")
  saveProfile(
    @CurrentUser() user: { id: string },
    @Param("cvId") cvId: string,
    @Body() dto: SaveProfileDto,
  ) {
    return this.matcher.saveProfile(user.id, cvId, dto.profile)
  }

  @Get("jobs")
  listJobs(@CurrentUser() user: { id: string }) {
    return this.matcher.listJobs(user.id)
  }

  @Post("jobs")
  createJob(@CurrentUser() user: { id: string }, @Body() dto: CreateJobDto) {
    return this.matcher.createJob(user.id, dto)
  }

  @Post("match")
  startMatch(@CurrentUser() user: { id: string }, @Body() dto: CreateMatchDto) {
    return this.matcher.startMatch(user.id, dto)
  }

  @Get("status/:id")
  status(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.matcher.getStatus(user.id, id)
  }

  @Get("results/:id")
  results(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.matcher.getResults(user.id, id)
  }

  @Get("history")
  history(@CurrentUser() user: { id: string }) {
    return this.matcher.getHistory(user.id)
  }

  @Delete("history/:id")
  removeHistory(@CurrentUser() user: { id: string }, @Param("id") id: string) {
    return this.matcher.deleteHistory(user.id, id)
  }
}
