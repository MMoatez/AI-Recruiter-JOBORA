import { useEffect, useState } from "react"
import type { PortfolioData, PortfolioTemplateId } from "../../api/portfolioApi"
import { createPortfolioPreviewSrcDoc } from "./PortfolioTemplates"
import { PORTFOLIO_PREVIEW_DRAFT_KEY, type PortfolioEditorDraft } from "./usePortfolio"

const TEMPLATE_IDS: PortfolioTemplateId[] = [
  "developer",
  "student",
  "minimal",
  "modern",
  "professional",
]

type PreviewDraft = {
  data: PortfolioData
  templateId: PortfolioTemplateId
}

function readPreviewDraft(): PreviewDraft | null {
  const raw = localStorage.getItem(PORTFOLIO_PREVIEW_DRAFT_KEY)
  if (!raw) return null

  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== "object" || parsed === null || !("templateId" in parsed)) return null
  const candidate = parsed as Partial<PortfolioEditorDraft>
  if (!candidate.templateId || !TEMPLATE_IDS.includes(candidate.templateId)) return null
  if (
    typeof candidate.fullName !== "string" ||
    !Array.isArray(candidate.sections) ||
    typeof candidate.theme !== "object" ||
    candidate.theme === null
  ) return null

  return { data: candidate as PortfolioData, templateId: candidate.templateId }
}

export default function PortfolioPreviewPage() {
  const [draft, setDraft] = useState<PreviewDraft | null>(() => {
    try {
      return readPreviewDraft()
    } catch {
      return null
    }
  })

  useEffect(() => {
    const updateDraft = (event: StorageEvent) => {
      if (event.key !== PORTFOLIO_PREVIEW_DRAFT_KEY) return
      try {
        setDraft(readPreviewDraft())
      } catch {
        setDraft(null)
      }
    }
    window.addEventListener("storage", updateDraft)
    return () => window.removeEventListener("storage", updateDraft)
  }, [])

  if (!draft) {
    return (
      <main className="portfolio-full-preview-error" role="alert">
        Le brouillon n’est pas disponible. Ouvre cet aperçu depuis l’éditeur Portfolio.
      </main>
    )
  }

  return (
    <main className="portfolio-full-preview">
      <iframe
        title="Aperçu plein écran du portfolio"
        srcDoc={createPortfolioPreviewSrcDoc(draft.data, draft.templateId)}
        sandbox=""
      />
    </main>
  )
}
