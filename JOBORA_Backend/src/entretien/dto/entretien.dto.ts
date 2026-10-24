import { Type } from "class-transformer"
import { IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator"

const levels = ["junior", "intermediaire", "senior"] as const
const sessionTypes = ["qcm", "ouverte", "technique", "rh", "mixte"] as const

export class AnalyzeOfferDto {
  @IsString() @MaxLength(8000) offerText!: string
}

export class CreateSessionDto {
  @IsString() @MaxLength(8000) offerText!: string
  @IsObject() offer!: Record<string, unknown>
  @IsString() @MaxLength(12000) cvText!: string
  @IsIn(sessionTypes) type!: (typeof sessionTypes)[number]
  @IsInt() @Min(1) @Max(20) count!: number
  @IsIn(levels) level!: (typeof levels)[number]
}

export class AnswerDto {
  @IsInt() @Min(0) questionIndex!: number
  @IsOptional() @IsInt() @Min(0) selectedIndex?: number
  @IsOptional() @IsString() @MaxLength(6000) answer?: string
}

export class MockInterviewDto {
  @IsOptional() @IsString() @MaxLength(4000) message?: string
}
