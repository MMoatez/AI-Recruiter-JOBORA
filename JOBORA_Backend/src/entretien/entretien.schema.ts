import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type PrepSessionDocument = HydratedDocument<PrepSession>

@Schema({ _id: false })
export class PrepQuestion {
  @Prop({ required: true }) skill!: string
  @Prop({ required: true, enum: ["qcm", "ouverte", "technique", "rh"] }) type!: string
  @Prop({ required: true }) question!: string
  @Prop({ type: [String], default: [] }) options!: string[]
  @Prop({ type: Number, default: null }) correct_index!: number | null
  @Prop({ default: "" }) expected_answer!: string
  @Prop({ default: "" }) explanation!: string
  @Prop({ required: true }) difficulty!: string
  @Prop({ type: String, default: null }) source!: string | null
  @Prop({ type: Boolean, default: null }) verified!: boolean | null
}

@Schema({ _id: false })
export class PrepAnswer {
  @Prop({ required: true }) questionIndex!: number
  @Prop({ type: String, default: null }) userAnswer!: string | null
  @Prop({ type: Number, default: null }) selectedIndex!: number | null
  @Prop({ required: true, enum: ["correct", "partiel", "incorrect"] }) verdict!: string
  @Prop({ required: true, min: 0, max: 100 }) score!: number
  @Prop({ default: "" }) feedback!: string
}

@Schema({ _id: false })
export class MockMessage {
  @Prop({ type: String, required: true, enum: ["assistant", "user"] }) role!: "assistant" | "user"
  @Prop({ required: true, maxlength: 4000 }) content!: string
}

@Schema({ timestamps: true, collection: "prep_sessions", minimize: false })
export class PrepSession {
  @Prop({ required: true, unique: true, index: true }) id!: string
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ required: true, maxlength: 8000 }) offerText!: string
  @Prop({ type: Object, required: true }) offer!: Record<string, unknown>
  @Prop({ default: "", maxlength: 12000 }) cvText!: string
  @Prop({ type: Object, required: true }) config!: {
    type: string
    count: number
    level: string
  }
  @Prop({ required: true, enum: ["generating", "ready", "failed", "completed"] }) status!: string
  @Prop({ type: String, default: null }) error!: string | null
  @Prop({ type: [PrepQuestion], default: [] }) questions!: PrepQuestion[]
  @Prop({ type: [PrepAnswer], default: [] }) answers!: PrepAnswer[]
  @Prop({ type: [String], default: [] }) weakSkills!: string[]
  @Prop({ type: [MockMessage], default: [] }) mockHistory!: MockMessage[]
  createdAt!: Date
}

export const PrepSessionSchema = SchemaFactory.createForClass(PrepSession)
PrepSessionSchema.index({ userId: 1, updatedAt: -1 })
