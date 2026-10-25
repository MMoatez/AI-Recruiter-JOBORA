import { IsString, MinLength } from "class-validator"

export class RankProjectsDto {
  @IsString()
  @MinLength(1)
  jobText!: string
}
