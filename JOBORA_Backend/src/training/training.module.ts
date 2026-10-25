import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { AuthModule } from "../auth/auth.module"
import { TrainingController } from "./training.controller"
import { TrainingService } from "./training.service"
import { TrainingMastery, TrainingMasterySchema, TrainingPlan, TrainingPlanSchema, TrainingProgress, TrainingProgressSchema, TrainingQuestion, TrainingQuestionSchema, TrainingSession, TrainingSessionSchema } from "./training.schemas"

@Module({ imports: [AuthModule, MongooseModule.forFeature([
  { name: TrainingPlan.name, schema: TrainingPlanSchema }, { name: TrainingProgress.name, schema: TrainingProgressSchema },
  { name: TrainingQuestion.name, schema: TrainingQuestionSchema }, { name: TrainingSession.name, schema: TrainingSessionSchema },
  { name: TrainingMastery.name, schema: TrainingMasterySchema },
])], controllers: [TrainingController], providers: [TrainingService] })
export class TrainingModule {}
