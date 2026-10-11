import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type CvDocument = HydratedDocument<Cv>

@Schema({ timestamps: true, collection: "cvs", minimize: false })
export class Cv {
  @Prop({ required: true, unique: true, index: true }) id!: string
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ required: true, trim: true }) title!: string
  @Prop({ default: "" }) targetJob!: string
  @Prop({ default: "" }) careerObjective!: string
  @Prop({ type: Object, required: true }) personalInformation!: Record<string, unknown>
  @Prop({ default: "" }) professionalSummary!: string
  @Prop({ type: [Object], default: [] }) education!: Record<string, unknown>[]
  @Prop({ type: [Object], default: [] }) experiences!: Record<string, unknown>[]
  @Prop({ type: [Object], default: [] }) projects!: Record<string, unknown>[]
  @Prop({ type: [String], default: [] }) technicalSkills!: string[]
  @Prop({ type: [String], default: [] }) softSkills!: string[]
  @Prop({ type: [String], default: [] }) tools!: string[]
  @Prop({ type: [Object], default: [] }) languages!: Record<string, unknown>[]
  @Prop({ type: [Object], default: [] }) certifications!: Record<string, unknown>[]
  @Prop({ type: Object, default: null }) atsValidation!: Record<string, unknown> | null
  @Prop({ default: "CV_PROMPT_003" }) promptVersion!: string
  @Prop({ enum: ["draft", "generated"], default: "draft" }) status!: "draft" | "generated"
}

export const CvSchema = SchemaFactory.createForClass(Cv)
CvSchema.index({ userId: 1, updatedAt: -1 })
