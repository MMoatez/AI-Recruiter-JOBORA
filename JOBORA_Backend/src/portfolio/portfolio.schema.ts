import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose"

@Schema({ _id: false })
export class PortfolioLinks {
  @Prop({ default: "" }) linkedin!: string
  @Prop({ default: "" }) github!: string
  @Prop({ default: "" }) website!: string
}

export const PortfolioLinksSchema = SchemaFactory.createForClass(PortfolioLinks)

@Schema({ _id: false })
export class PortfolioSection {
  @Prop({ required: true, enum: ["home", "about", "skills", "experiences", "projects", "certifications", "contact"] })
  id!: "home" | "about" | "skills" | "experiences" | "projects" | "certifications" | "contact"

  @Prop({ default: true }) visible!: boolean
  @Prop({ required: true, min: 0 }) order!: number
}

export const PortfolioSectionSchema = SchemaFactory.createForClass(PortfolioSection)

@Schema({ _id: false })
export class PortfolioTheme {
  @Prop({ default: "#5b5bd6", match: /^#[0-9a-fA-F]{6}$/ })
  accentColor!: string
}

export const PortfolioThemeSchema = SchemaFactory.createForClass(PortfolioTheme)

@Schema({ _id: false })
export class PortfolioContactVisibility {
  @Prop({ default: false }) email!: boolean
  @Prop({ default: false }) phone!: boolean
}

export const PortfolioContactVisibilitySchema = SchemaFactory.createForClass(PortfolioContactVisibility)

@Schema({ _id: false })
export class PortfolioEducation {
  @Prop({ default: "" }) school!: string
  @Prop({ default: "" }) degree!: string
  @Prop({ default: "" }) field!: string
  @Prop({ default: "" }) startYear!: string
  @Prop({ default: "" }) endYear!: string
}

export const PortfolioEducationSchema = SchemaFactory.createForClass(PortfolioEducation)

@Schema({ _id: false })
export class PortfolioExperience {
  @Prop({ default: "" }) company!: string
  @Prop({ default: "" }) role!: string
  @Prop({ default: "" }) startDate!: string
  @Prop({ default: "" }) endDate!: string
  @Prop({ default: "" }) description!: string
  @Prop({ type: [String], default: [] }) technologies!: string[]
}

export const PortfolioExperienceSchema = SchemaFactory.createForClass(PortfolioExperience)

@Schema({ _id: false })
export class PortfolioProject {
  @Prop({ default: "" }) name!: string
  @Prop({ default: "" }) year!: string
  @Prop({ default: "" }) description!: string
  @Prop({ type: [String], default: [] }) technologies!: string[]
}

export const PortfolioProjectSchema = SchemaFactory.createForClass(PortfolioProject)

@Schema({ _id: false })
export class PortfolioSkills {
  @Prop({ type: [String], default: [] }) languages!: string[]
  @Prop({ type: [String], default: [] }) frameworks!: string[]
  @Prop({ type: [String], default: [] }) tools!: string[]
  @Prop({ type: [String], default: [] }) databases!: string[]
  @Prop({ type: [String], default: [] }) other!: string[]
}

export const PortfolioSkillsSchema = SchemaFactory.createForClass(PortfolioSkills)

@Schema({ _id: false })
export class PortfolioLanguage {
  @Prop({ default: "" }) name!: string
  @Prop({ default: "" }) level!: string
}

export const PortfolioLanguageSchema = SchemaFactory.createForClass(PortfolioLanguage)

@Schema({ _id: false })
export class PortfolioCertification {
  @Prop({ default: "" }) name!: string
  @Prop({ default: "" }) issuer!: string
  @Prop({ default: "" }) year!: string
}

export const PortfolioCertificationSchema = SchemaFactory.createForClass(PortfolioCertification)

@Schema({ _id: false })
export class PortfolioData {
  @Prop({ default: "" }) fullName!: string
  @Prop({ default: "" }) title!: string
  @Prop({ default: "" }) headline!: string
  @Prop({ default: true }) availableForWork!: boolean
  @Prop({ default: false }) showCvDownload!: boolean
  @Prop({ default: "" }) email!: string
  @Prop({ default: "" }) phone!: string
  @Prop({ default: "" }) location!: string
  @Prop({ type: PortfolioLinksSchema, default: () => ({}) }) links!: PortfolioLinks
  @Prop({
    type: [PortfolioSectionSchema],
    default: [
      { id: "home", visible: true, order: 0 },
      { id: "about", visible: true, order: 1 },
      { id: "skills", visible: true, order: 2 },
      { id: "experiences", visible: true, order: 3 },
      { id: "projects", visible: true, order: 4 },
      { id: "certifications", visible: true, order: 5 },
      { id: "contact", visible: true, order: 6 },
    ],
  })
  sections!: PortfolioSection[]
  @Prop({ type: PortfolioThemeSchema, default: () => ({}) }) theme!: PortfolioTheme
  @Prop({ type: PortfolioContactVisibilitySchema, default: () => ({}) })
  contactVisibility!: PortfolioContactVisibility
  @Prop({ default: "" }) about!: string
  @Prop({ type: [PortfolioEducationSchema], default: [] }) education!: PortfolioEducation[]
  @Prop({ type: [PortfolioExperienceSchema], default: [] }) experiences!: PortfolioExperience[]
  @Prop({ type: [PortfolioProjectSchema], default: [] }) projects!: PortfolioProject[]
  @Prop({ type: PortfolioSkillsSchema, default: () => ({}) }) skills!: PortfolioSkills
  @Prop({ type: [PortfolioLanguageSchema], default: [] }) languages!: PortfolioLanguage[]
  @Prop({ type: [PortfolioCertificationSchema], default: [] }) certifications!: PortfolioCertification[]
}

export const PortfolioDataSchema = SchemaFactory.createForClass(PortfolioData)

export type PortfolioDocument = HydratedDocument<Portfolio>

export const PORTFOLIO_TEMPLATE_IDS = ["developer", "student", "minimal", "modern", "professional"] as const

@Schema({ timestamps: true, collection: "portfolios", minimize: false })
export class Portfolio {
  @Prop({ type: MongooseSchema.Types.ObjectId, required: true, unique: true, index: true, ref: "User" })
  userId!: Types.ObjectId

  @Prop({ type: PortfolioDataSchema, required: true, default: () => ({}) })
  data!: PortfolioData

  @Prop({ type: String, enum: PORTFOLIO_TEMPLATE_IDS, default: "developer", trim: true })
  templateId!: typeof PORTFOLIO_TEMPLATE_IDS[number]

  @Prop({ type: String, unique: true, sparse: true, index: true, trim: true })
  slug?: string

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null

  @Prop({ type: Date, default: null })
  lastSyncedAt!: Date | null

  @Prop({ default: "" })
  sourceCvName!: string

  @Prop({ type: String, default: "", select: false })
  sourceCvText!: string

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null, select: false })
  sourceCvFileId!: Types.ObjectId | null

  @Prop({ type: [String], default: [] })
  removedItems!: string[]

  @Prop({ enum: ["draft", "published"], default: "draft" })
  status!: "draft" | "published"
}

export const PortfolioSchema = SchemaFactory.createForClass(Portfolio)
