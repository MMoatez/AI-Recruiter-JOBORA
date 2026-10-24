import { IsIn, IsString } from "class-validator"
import { PORTFOLIO_TEMPLATE_IDS } from "./portfolio.schema"

export class PortfolioTemplateDto {
  @IsString()
  @IsIn(PORTFOLIO_TEMPLATE_IDS)
  templateId!: string
}
