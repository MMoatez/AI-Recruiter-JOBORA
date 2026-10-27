import { IsString, MaxLength, MinLength } from "class-validator"

export class AnalyzeMatchingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  cvId!: string

  @IsString()
  @MinLength(20)
  @MaxLength(30000)
  jobDescription!: string
}
