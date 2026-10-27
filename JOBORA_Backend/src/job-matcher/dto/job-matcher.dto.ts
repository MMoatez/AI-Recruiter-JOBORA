import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator"
import type { Seniority, WorkArrangement } from "../job-matcher.types"

export const SENIORITY_VALUES: Seniority[] = ["junior", "mid", "senior", "unknown"]
export const WORK_ARRANGEMENT_VALUES: WorkArrangement[] = ["remote", "hybrid", "onsite", "unknown"]

export class SelectCvDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  cvId!: string
}

export class ProfileDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(150)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  skills?: string[]

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  experienceYears?: number | null

  @IsOptional()
  @IsIn(SENIORITY_VALUES)
  seniority?: Seniority

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  jobTitles?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  languages?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  education?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  certifications?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  preferredLocations?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  workPreferences?: string[]
}

export class SaveProfileDto {
  @ValidateNested()
  @Type(() => ProfileDto)
  profile!: ProfileDto
}

export class CreateJobDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  company?: string

  @IsString()
  @MinLength(20)
  @MaxLength(30000)
  description!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  requiredSkills?: string[]

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(60)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  preferredSkills?: string[]

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  minExperienceYears?: number | null

  @IsOptional()
  @IsIn(SENIORITY_VALUES)
  seniority?: Seniority

  @IsOptional()
  @IsString()
  @MaxLength(160)
  location?: string

  @IsOptional()
  @IsIn(WORK_ARRANGEMENT_VALUES)
  workArrangement?: WorkArrangement

  @IsOptional()
  @IsString()
  @MaxLength(80)
  contractType?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  salaryRange?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  sourceUrl?: string
}

export class CreateMatchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  cvId!: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(120, { each: true })
  jobIds?: string[]

  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileDto)
  profile?: ProfileDto

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  topN?: number
}
