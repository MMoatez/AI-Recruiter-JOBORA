import { IsString, MinLength } from "class-validator"

export class ExtractPortfolioDto {
  @IsString()
  @MinLength(1)
  cvText!: string
}
