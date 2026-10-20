import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, MaxLength, Min, ValidateIf, ValidateNested } from "class-validator"

class PersonalInformationDto {
  @IsString() @MaxLength(80) firstName!: string
  @IsString() @MaxLength(80) lastName!: string
  @ValidateIf((value: PersonalInformationDto) => value.email !== "") @IsEmail() @MaxLength(180) email!: string
  @IsOptional() @IsString() @MaxLength(40) phone?: string
  @IsOptional() @IsString() @MaxLength(120) location?: string
  @IsOptional() @IsString() @MaxLength(250) linkedin?: string
  @IsOptional() @IsString() @MaxLength(250) github?: string
}

class EducationDto {
  @IsOptional() @IsString() id?: string
  @IsString() @MaxLength(160) degree!: string
  @IsString() @MaxLength(160) institution!: string
  @IsOptional() @IsString() @MaxLength(120) location?: string
  @IsOptional() @IsString() @MaxLength(40) startDate?: string
  @IsOptional() @IsString() @MaxLength(40) endDate?: string
  @IsOptional() @IsString() @MaxLength(1500) description?: string
}

class ExperienceDto {
  @IsOptional() @IsString() id?: string
  @IsString() @MaxLength(160) jobTitle!: string
  @IsString() @MaxLength(160) company!: string
  @IsOptional() @IsString() @MaxLength(120) location?: string
  @IsOptional() @IsString() @MaxLength(40) startDate?: string
  @IsOptional() @IsString() @MaxLength(40) endDate?: string
  @IsOptional() @IsString() @MaxLength(4000) rawDescription?: string
  @IsOptional() @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) bulletPoints?: string[]
}

class ProjectDto {
  @IsOptional() @IsString() id?: string
  @IsString() @MaxLength(180) name!: string
  @IsOptional() @IsString() @MaxLength(2000) description?: string
  @IsArray() @ArrayMaxSize(30) @IsString({ each: true }) technologies!: string[]
  @IsOptional() @IsString() @MaxLength(300) link?: string
}

class LanguageDto {
  @IsOptional() @IsString() id?: string
  @IsString() @MaxLength(80) language!: string
  @IsString() @MaxLength(80) level!: string
}

class CertificationDto {
  @IsOptional() @IsString() id?: string
  @IsString() @MaxLength(180) name!: string
  @IsOptional() @IsString() @MaxLength(180) organization?: string
  @IsOptional() @IsString() @MaxLength(40) date?: string
}

export class CreateCvDto {
  @IsString() @MaxLength(180) id!: string
  @IsString() @MaxLength(180) title!: string
  @IsOptional() @IsString() @MaxLength(180) targetJob?: string
  @IsOptional() @IsString() @MaxLength(2000) careerObjective?: string
  @IsObject() @ValidateNested() @Type(() => PersonalInformationDto) personalInformation!: PersonalInformationDto
  @IsOptional() @IsString() @MaxLength(2500) professionalSummary?: string
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => EducationDto) education!: EducationDto[]
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ExperienceDto) experiences!: ExperienceDto[]
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ProjectDto) projects!: ProjectDto[]
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) technicalSkills!: string[]
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) softSkills!: string[]
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) tools!: string[]
  @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => LanguageDto) languages!: LanguageDto[]
  @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => CertificationDto) certifications!: CertificationDto[]
  @IsOptional() @IsObject() atsValidation?: Record<string, unknown>
  @IsOptional() @IsObject() ragMetadata?: Record<string, unknown>
  @IsOptional() @IsObject() generatedContent?: Record<string, unknown>
  @IsOptional() @IsString() @IsIn(["draft", "generated"]) status?: "draft" | "generated"
  @IsOptional() @IsString() @MaxLength(40) promptVersion?: string
}

export class UpdateCvDto extends CreateCvDto {}

export class RegenerateSectionDto {
  @IsString() @IsIn(["summary", "experience", "project"]) section!: "summary" | "experience" | "project"
  @IsOptional() @IsInt() @Min(0) index?: number
}
