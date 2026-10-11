import { ConflictException, Injectable, NotFoundException } from "@nestjs/common"
import { InjectModel } from "@nestjs/mongoose"
import { Model } from "mongoose"
import { AtsValidationService } from "./ats-validation.service"
import { Cv, CvDocument } from "./cv.schema"
import { CreateCvDto, RegenerateSectionDto, UpdateCvDto } from "./dto/cv.dto"
import { GeminiService } from "./gemini.service"

@Injectable()
export class CvService {
  constructor(
    @InjectModel(Cv.name) private readonly cvs: Model<CvDocument>,
    private readonly gemini: GeminiService,
    private readonly ats: AtsValidationService,
  ) {}

  list(userId: string) { return this.cvs.find({ userId }).sort({ updatedAt: -1 }).lean() }

  async get(userId: string, id: string) {
    const cv = await this.cvs.findOne({ id, userId }).lean()
    if (!cv) throw new NotFoundException("CV introuvable.")
    return cv
  }

  async create(userId: string, dto: CreateCvDto) {
    if (await this.cvs.exists({ id: dto.id })) throw new ConflictException("Ce CV existe déjà.")
    return this.cvs.create({ ...dto, userId } as unknown as Cv)
  }

  async update(userId: string, id: string, dto: UpdateCvDto) {
    const cv = await this.cvs.findOneAndUpdate({ id, userId }, { $set: { ...dto, id, userId } }, { new: true, runValidators: true })
    if (!cv) throw new NotFoundException("CV introuvable.")
    return cv
  }

  async remove(userId: string, id: string) {
    const result = await this.cvs.deleteOne({ id, userId })
    if (!result.deletedCount) throw new NotFoundException("CV introuvable.")
    return { deleted: true }
  }

  async generate(userId: string, id: string) {
    const current = await this.get(userId, id)
    const generated = await this.gemini.generate(this.toSafeCandidate(current as unknown as Record<string, unknown>))
    const next = { ...generated, atsValidation: this.ats.validate(generated), status: "generated", promptVersion: "CV_PROMPT_003" }
    return this.cvs.findOneAndUpdate({ id, userId }, { $set: next }, { new: true, runValidators: true })
  }

  validate(userId: string, id: string) {
    return this.get(userId, id).then((cv) => this.ats.validate(cv))
  }

  async regenerateSection(userId: string, id: string, dto: RegenerateSectionDto) {
    const current = await this.get(userId, id) as unknown as Record<string, unknown>
    const targetJob = String(current.targetJob ?? "")
    const index = dto.index ?? 0
    const experiences = [...((current.experiences as Array<Record<string, unknown>>) ?? [])]
    const projects = [...((current.projects as Array<Record<string, unknown>>) ?? [])]
    let source: unknown
    if (dto.section === "summary") source = { professionalSummary: current.professionalSummary, careerObjective: current.careerObjective, technicalSkills: current.technicalSkills }
    else if (dto.section === "experience") source = experiences[index]
    else source = projects[index]
    if (!source) throw new NotFoundException("Section du CV introuvable.")
    const content = await this.gemini.regenerateSection(dto.section, source, targetJob)
    if (dto.section === "summary") {
      current.professionalSummary = content
    } else if (dto.section === "experience") {
      experiences[index] = { ...experiences[index], bulletPoints: content }
      current.experiences = experiences
    } else {
      projects[index] = { ...projects[index], description: content }
      current.projects = projects
    }
    current.atsValidation = this.ats.validate(current)
    return this.cvs.findOneAndUpdate({ id, userId }, { $set: current }, { new: true, runValidators: true })
  }

  private toSafeCandidate(cv: Record<string, unknown>) {
    const { _id, userId, atsValidation, createdAt, updatedAt, ...candidate } = cv
    void _id; void userId; void atsValidation; void createdAt; void updatedAt
    return candidate
  }
}
