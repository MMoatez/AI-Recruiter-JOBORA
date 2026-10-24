import { Type } from "class-transformer"
import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsObject, IsString, Matches, Min, ValidateIf, ValidateNested } from "class-validator"
import {
  PortfolioCertification,
  PortfolioContactVisibility,
  PortfolioData,
  PortfolioEducation,
  PortfolioExperience,
  PortfolioLanguage,
  PortfolioLinks,
  PortfolioProject,
  PortfolioSection,
  PortfolioSectionId,
  PortfolioSkills,
  PortfolioTheme,
  defaultPortfolioSections,
} from "./portfolio-data"

export class PortfolioLinksDto implements PortfolioLinks {
  @IsString() linkedin = ""
  @IsString() github = ""
  @IsString() website = ""
}

export class PortfolioEducationDto implements PortfolioEducation {
  @IsString() school = ""
  @IsString() degree = ""
  @IsString() field = ""
  @IsString() startYear = ""
  @IsString() endYear = ""
}

export class PortfolioExperienceDto implements PortfolioExperience {
  @IsString() company = ""
  @IsString() role = ""
  @IsString() startDate = ""
  @IsString() endDate = ""
  @IsString() description = ""
  @IsArray() @IsString({ each: true }) technologies: string[] = []
}

export class PortfolioProjectDto implements PortfolioProject {
  @IsString() name = ""
  @IsString() year = ""
  @IsString() description = ""
  @IsArray() @IsString({ each: true }) technologies: string[] = []
}

export class PortfolioSkillsDto implements PortfolioSkills {
  @IsArray() @IsString({ each: true }) languages: string[] = []
  @IsArray() @IsString({ each: true }) frameworks: string[] = []
  @IsArray() @IsString({ each: true }) tools: string[] = []
  @IsArray() @IsString({ each: true }) databases: string[] = []
  @IsArray() @IsString({ each: true }) other: string[] = []
}

export class PortfolioLanguageDto implements PortfolioLanguage {
  @IsString() name = ""
  @IsString() level = ""
}

export class PortfolioCertificationDto implements PortfolioCertification {
  @IsString() name = ""
  @IsString() issuer = ""
  @IsString() year = ""
}

const PORTFOLIO_SECTION_IDS: PortfolioSectionId[] = [
  "home",
  "about",
  "skills",
  "experiences",
  "projects",
  "certifications",
  "contact",
]

export class PortfolioSectionDto implements PortfolioSection {
  @IsString() @IsIn(PORTFOLIO_SECTION_IDS) id: PortfolioSectionId = "home"
  @IsBoolean() visible = true
  @IsInt() @Min(0) order = 0
}

export class PortfolioThemeDto implements PortfolioTheme {
  @IsString() @Matches(/^#[0-9a-fA-F]{6}$/) accentColor = "#5b5bd6"
}

export class PortfolioContactVisibilityDto implements PortfolioContactVisibility {
  @IsBoolean() email = false
  @IsBoolean() phone = false
}

export class PortfolioDataDto implements PortfolioData {
  @IsString() fullName = ""
  @IsString() title = ""
  @IsString() headline = ""
  @IsBoolean() availableForWork = true
  @IsBoolean() showCvDownload = false
  @ValidateIf((data: PortfolioDataDto) => data.email !== "")
  @IsEmail()
  email = ""
  @IsString() phone = ""
  @IsString() location = ""

  @IsObject()
  @ValidateNested()
  @Type(() => PortfolioLinksDto)
  links = new PortfolioLinksDto()

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioSectionDto)
  sections: PortfolioSectionDto[] = defaultPortfolioSections()

  @IsObject()
  @ValidateNested()
  @Type(() => PortfolioThemeDto)
  theme = new PortfolioThemeDto()

  @IsObject()
  @ValidateNested()
  @Type(() => PortfolioContactVisibilityDto)
  contactVisibility = new PortfolioContactVisibilityDto()

  @IsString() about = ""

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioEducationDto)
  education: PortfolioEducationDto[] = []

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioExperienceDto)
  experiences: PortfolioExperienceDto[] = []

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioProjectDto)
  projects: PortfolioProjectDto[] = []

  @IsObject()
  @ValidateNested()
  @Type(() => PortfolioSkillsDto)
  skills = new PortfolioSkillsDto()

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioLanguageDto)
  languages: PortfolioLanguageDto[] = []

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PortfolioCertificationDto)
  certifications: PortfolioCertificationDto[] = []
}
