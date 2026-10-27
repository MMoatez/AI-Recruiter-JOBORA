import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common"
import { CurrentUser } from "../auth/current-user.decorator"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { AnalyzeTrainingDto, CreateAssessmentDto, ProgressDto, SubmitAssessmentDto } from "./dto/training.dto"
import { TrainingService } from "./training.service"

@Controller("training")
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly training: TrainingService) {}
  @Post("analyze") analyze(@CurrentUser() user: { id: string }, @Body() dto: AnalyzeTrainingDto) { return this.training.analyze(user.id, dto) }
  @Get("plans/:id") plan(@CurrentUser() user: { id: string }, @Param("id") id: string) { return this.training.getPlan(user.id, id) }
  @Patch("plans/:planId/tasks/:taskId/progress") progress(@CurrentUser() user: { id: string }, @Param("planId") planId: string, @Param("taskId") taskId: string, @Body() dto: ProgressDto) { return this.training.updateProgress(user.id, planId, taskId, dto) }
  @Post("assessments") assessment(@CurrentUser() user: { id: string }, @Body() dto: CreateAssessmentDto) { return this.training.createAssessment(user.id, dto) }
  @Post("assessments/:id/submit") submit(@CurrentUser() user: { id: string }, @Param("id") id: string, @Body() dto: SubmitAssessmentDto) { return this.training.submitAssessment(user.id, id, dto) }
  @Get("mastery") history(@CurrentUser() user: { id: string }) { return this.training.history(user.id) }
  @Get("recommendations") recommendations(@CurrentUser() user: { id: string }) { return this.training.recommendations(user.id) }
}
