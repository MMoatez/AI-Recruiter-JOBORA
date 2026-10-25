import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type TrainingPlanDocument = HydratedDocument<TrainingPlan>
@Schema({ timestamps: true, collection: "training_plans" })
export class TrainingPlan {
  createdAt!: Date
  updatedAt!: Date
  @Prop({ required: true, unique: true, index: true }) id!: string
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ required: true }) title!: string
  @Prop({ required: true }) careerGoal!: string
  @Prop({ required: true }) weeklyHours!: number
  @Prop({ required: true }) targetWeeks!: number
  @Prop({ required: true, enum: ["fr", "en"] }) preferredLanguage!: string
  @Prop({ required: true }) freeOnly!: boolean
  @Prop({ required: true, enum: ["draft", "ready", "failed"] }) status!: string
  @Prop({ required: true, enum: ["manual", "live_ai"] }) provenance!: string
  @Prop() modelName?: string
  @Prop({ type: Object, default: {} }) content!: Record<string, unknown>
}
export const TrainingPlanSchema = SchemaFactory.createForClass(TrainingPlan)
TrainingPlanSchema.index({ userId: 1, updatedAt: -1 })

export type TrainingProgressDocument = HydratedDocument<TrainingProgress>
@Schema({ timestamps: true, collection: "training_task_progress" })
export class TrainingProgress {
  createdAt!: Date
  updatedAt!: Date
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ required: true, index: true }) planId!: string
  @Prop({ required: true }) taskId!: string
  @Prop({ required: true, enum: ["not_started", "in_progress", "completed"] }) status!: string
  @Prop({ required: true, min: 0, max: 100 }) completionPercent!: number
  @Prop({ required: true, min: 0, default: 0 }) minutesSpent!: number
  @Prop({ type: String, default: null }) evidenceNote?: string | null
}
export const TrainingProgressSchema = SchemaFactory.createForClass(TrainingProgress)
TrainingProgressSchema.index({ userId: 1, planId: 1, taskId: 1 }, { unique: true })

export type TrainingQuestionDocument = HydratedDocument<TrainingQuestion>
@Schema({ timestamps: true, collection: "training_assessment_questions" })
export class TrainingQuestion {
  @Prop({ required: true, unique: true, index: true }) id!: string
  @Prop({ required: true, index: true }) conceptId!: string
  @Prop({ required: true, index: true }) skill!: string
  @Prop({ required: true }) prompt!: string
  @Prop({ required: true, type: [String] }) choices!: string[]
  @Prop({ required: true }) correctChoice!: number
  @Prop({ required: true }) explanation!: string
  @Prop({ required: true, enum: ["beginner", "intermediate", "advanced"] }) difficulty!: string
  @Prop({ required: true, enum: ["approved", "pending_review", "rejected"], index: true }) reviewStatus!: string
  @Prop({ required: true, enum: ["curated", "groq"] }) source!: string
  @Prop() reviewedBy?: string
  @Prop() reviewedAt?: Date
  @Prop() reviewDecision?: string
  @Prop({ required: true, default: 1 }) questionBankVersion!: number
}
export const TrainingQuestionSchema = SchemaFactory.createForClass(TrainingQuestion)
TrainingQuestionSchema.index({ skill: 1, reviewStatus: 1 })

export type TrainingSessionDocument = HydratedDocument<TrainingSession>
@Schema({ timestamps: true, collection: "training_assessment_sessions" })
export class TrainingSession {
  createdAt!: Date
  updatedAt!: Date
  @Prop({ required: true, unique: true, index: true }) id!: string
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ index: true }) planId?: string
  @Prop({ required: true }) skill!: string
  @Prop({ required: true, enum: ["active", "processing", "submitted"], index: true }) status!: string
  @Prop({ required: true, type: [String] }) questionIds!: string[]
  @Prop({ type: [{ questionId: String, selectedChoice: Number, isCorrect: Boolean, answeredAt: Date }], default: [] }) answers!: Array<Record<string, unknown>>
  @Prop() submittedAt?: Date
}
export const TrainingSessionSchema = SchemaFactory.createForClass(TrainingSession)
TrainingSessionSchema.index({ userId: 1, createdAt: -1 })

export type TrainingMasteryDocument = HydratedDocument<TrainingMastery>
@Schema({ timestamps: true, collection: "training_mastery_history" })
export class TrainingMastery {
  createdAt!: Date
  updatedAt!: Date
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ required: true, index: true }) conceptId!: string
  @Prop({ required: true }) skill!: string
  @Prop({ required: true, index: true }) sessionId!: string
  @Prop({ required: true }) questionId!: string
  @Prop({ required: true, min: 0, max: 1 }) prior!: number
  @Prop({ required: true, min: 0, max: 1 }) observationPosterior!: number
  @Prop({ required: true, min: 0, max: 1 }) nextPrior!: number
  @Prop({ required: true }) correct!: boolean
  @Prop({ required: true }) parameterVersion!: string
}
export const TrainingMasterySchema = SchemaFactory.createForClass(TrainingMastery)
TrainingMasterySchema.index({ sessionId: 1, questionId: 1 }, { unique: true })
TrainingMasterySchema.index({ userId: 1, conceptId: 1, createdAt: 1 })
