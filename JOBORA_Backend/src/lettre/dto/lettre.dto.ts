import { Type } from "class-transformer"
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator"
import { letterLanguages, letterRoles, letterTones } from "../lettre.schema"

export const rewriteActions = ["regenerer", "raccourcir", "plus_formel", "plus_dynamique"] as const

export class GenerateLetterDto {
  /** CV JOBORA existant (prioritaire)… */
  @IsOptional() @IsString() @MaxLength(80) cvId?: string
  /** …ou texte extrait d'un PDF importé (anonymisé côté backend avant l'IA). */
  @IsOptional() @IsString() @MaxLength(12000) cvText?: string
  @IsString() @MinLength(40) @MaxLength(8000) offerText!: string
  @IsIn(letterLanguages) language!: (typeof letterLanguages)[number]
  @IsIn(letterTones) tone!: (typeof letterTones)[number]
  @IsOptional() @IsString() @MaxLength(120) company?: string
}

export class ParagraphDto {
  @IsIn(letterRoles) role!: (typeof letterRoles)[number]
  @IsString() @MaxLength(3000) text!: string
  @IsArray() @ArrayMaxSize(12) @IsString({ each: true }) sources!: string[]
}

export class UpdateLetterDto {
  @IsOptional() @IsString() @MaxLength(160) subject?: string
  @IsArray() @ArrayMaxSize(4) @ValidateNested({ each: true }) @Type(() => ParagraphDto) paragraphs!: ParagraphDto[]
}

export class RewriteParagraphDto {
  @IsIn(rewriteActions) action!: (typeof rewriteActions)[number]
}
