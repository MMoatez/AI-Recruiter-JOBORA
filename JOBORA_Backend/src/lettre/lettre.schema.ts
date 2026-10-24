import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument } from "mongoose"

export type CoverLetterDocument = HydratedDocument<CoverLetter>

export const letterRoles = ["introduction", "experience", "fit", "motivation"] as const
export const letterLanguages = ["fr", "en"] as const
export const letterTones = ["formel", "dynamique", "creatif"] as const

@Schema({ _id: false })
export class LetterParagraph {
  @Prop({ required: true, enum: letterRoles }) role!: string
  @Prop({ required: true, maxlength: 3000 }) text!: string
  @Prop({ type: [String], default: [] }) sources!: string[]
}

@Schema({ _id: false })
export class LetterVersion {
  @Prop({ required: true }) label!: string
  @Prop({ default: "" }) subject!: string
  @Prop({ type: [LetterParagraph], default: [] }) paragraphs!: LetterParagraph[]
  @Prop({ type: Date, default: () => new Date() }) savedAt!: Date
}

@Schema({ timestamps: true, collection: "cover_letters", minimize: false })
export class CoverLetter {
  @Prop({ required: true, unique: true, index: true }) id!: string
  @Prop({ required: true, index: true }) userId!: string
  @Prop({ required: true, maxlength: 160 }) title!: string
  @Prop({ type: String, default: null }) cvId!: string | null
  @Prop({ default: "" }) cvTitle!: string
  @Prop({ required: true, maxlength: 8000 }) offerText!: string
  @Prop({ default: "" }) company!: string
  @Prop({ default: "" }) jobTitle!: string
  @Prop({ required: true, enum: letterLanguages }) language!: string
  @Prop({ required: true, enum: letterTones }) tone!: string
  @Prop({ default: "" }) subject!: string
  @Prop({ default: "" }) salutation!: string
  @Prop({ default: "" }) closing!: string
  @Prop({ type: [LetterParagraph], default: [] }) paragraphs!: LetterParagraph[]
  /** Faits anonymisés utilisés par l'IA : permettent d'expliquer et de réécrire un paragraphe. */
  @Prop({ type: [Object], default: [] }) facts!: Record<string, unknown>[]
  @Prop({ type: [String], default: [] }) matchedSkills!: string[]
  @Prop({ type: [String], default: [] }) missingSkills!: string[]
  @Prop({ type: [String], default: [] }) warnings!: string[]
  @Prop({ type: [LetterVersion], default: [] }) versions!: LetterVersion[]
  @Prop({ enum: ["generated", "edited"], default: "generated" }) status!: string
  @Prop({ default: "" }) aiModel!: string
  @Prop({ default: "LETTER_GENERATE_001_V1" }) promptVersion!: string
}

export const CoverLetterSchema = SchemaFactory.createForClass(CoverLetter)
CoverLetterSchema.index({ userId: 1, updatedAt: -1 })
