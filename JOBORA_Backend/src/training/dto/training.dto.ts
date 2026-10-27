import { Type } from "class-transformer"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator"

export class CandidateSkillDto { @IsString() @MaxLength(100) name!: string; @IsIn(["beginner", "intermediate", "advanced", "unknown"]) level = "unknown"; @IsArray() evidence: string[] = [] }
export class AnalyzeTrainingDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => CandidateSkillDto) candidate_skills!: CandidateSkillDto[]
  @IsOptional() @IsString() @MaxLength(20000) sanitized_cv_text?: string
  @IsString() @MinLength(20) @MaxLength(30000) job_description!: string
  @IsString() @MinLength(2) @MaxLength(500) career_goal!: string
  @IsIn(["beginner", "intermediate", "advanced"]) current_level!: string
  @IsInt() @Min(1) @Max(40) weekly_hours!: number
  @IsInt() @Min(1) @Max(52) target_weeks!: number
  @IsIn(["fr", "en"]) preferred_language = "fr"
  @IsBoolean() free_only = true
}
export class ProgressDto {
  @IsIn(["not_started", "in_progress", "completed"]) status!: string
  @IsInt() @Min(0) @Max(100) completion_percent!: number
  @IsInt() @Min(0) minutes_spent = 0
  @IsOptional() @IsString() @MaxLength(1000) evidence_note?: string | null
}
export class CreateAssessmentDto { @IsString() @MinLength(1) @MaxLength(100) skill!: string; @IsOptional() @IsString() plan_id?: string }
export class AnswerDto { @IsString() question_id!: string; @IsInt() @Min(0) @Max(9) selected_choice!: number }
export class SubmitAssessmentDto { @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => AnswerDto) answers!: AnswerDto[] }
