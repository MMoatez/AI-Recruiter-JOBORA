import type { PortfolioData } from "./portfolio-data"

export type PortfolioDocument = {
  id: string
  userId: string
  data: PortfolioData
  templateId: "developer" | "student" | "minimal" | "modern" | "professional"
  slug?: string | null
  publishedAt: Date | null
  lastSyncedAt: Date | null
  sourceCvName: string
  sourceCvText: string
  sourceCvFileId?: string | null
  removedItems: string[]
  status: "draft" | "published"
  createdAt: string
  updatedAt: string
}

export const PORTFOLIO_TEMPLATE_IDS = ["developer", "student", "minimal", "modern", "professional"] as const
