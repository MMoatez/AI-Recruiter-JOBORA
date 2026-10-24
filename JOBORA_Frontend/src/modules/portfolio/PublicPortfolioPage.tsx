import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import type { PortfolioData, PublicPortfolio } from "../../api/portfolioApi"
import { getPublicPortfolio } from "../../api/portfolioApi"
import { ApiError } from "../../services/api"
import { createPortfolioPreviewSrcDoc } from "./PortfolioTemplates"

type PublicPageState =
  | { status: "loading" }
  | { status: "ready"; portfolio: PublicPortfolio }
  | { status: "not-found" }
  | { status: "error"; message: string }

function updateMeta(selector: string, attribute: string, key: string, value: string): () => void {
  let element = document.head.querySelector<HTMLMetaElement>(selector)
  const existed = Boolean(element)
  if (!element) {
    element = document.createElement("meta")
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  const previous = element.getAttribute("content")
  element.setAttribute("content", value)
  return () => {
    if (!element) return
    if (existed) {
      if (previous === null) element.removeAttribute("content")
      else element.setAttribute("content", previous)
    } else {
      element.remove()
    }
  }
}

export default function PublicPortfolioPage() {
  const { slug = "" } = useParams()
  const [state, setState] = useState<PublicPageState>({ status: "loading" })

  useEffect(() => {
    let active = true
    setState({ status: "loading" })
    getPublicPortfolio(slug).then(
      (portfolio) => {
        if (active) setState({ status: "ready", portfolio })
      },
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          if (active) setState({ status: "not-found" })
          return
        }
        const message = error instanceof ApiError
          ? error.message
          : "Impossible de charger ce portfolio."
        if (active) setState({ status: "error", message })
      },
    )
    return () => {
      active = false
    }
  }, [slug])

  useEffect(() => {
    if (state.status !== "ready") return
    const { data } = state.portfolio
    const pageTitle = data.fullName
      ? `${data.fullName} — Portfolio`
      : data.title
        ? `${data.title} — Portfolio`
        : "Portfolio"
    const description = (data.headline || data.about || data.title || `Découvrez le portfolio de ${data.fullName}.`)
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 200)
    const previousTitle = document.title
    document.title = pageTitle
    const restoreDescription = updateMeta('meta[name="description"]', "name", "description", description)
    const restoreOgTitle = updateMeta('meta[property="og:title"]', "property", "og:title", pageTitle)
    const restoreOgDescription = updateMeta('meta[property="og:description"]', "property", "og:description", description)
    return () => {
      document.title = previousTitle
      restoreDescription()
      restoreOgTitle()
      restoreOgDescription()
    }
  }, [state])

  if (state.status === "loading") {
    return <main className="portfolio-public-state" role="status">Chargement du portfolio…</main>
  }
  if (state.status === "not-found") {
    return (
      <main className="portfolio-public-not-found">
        <div>
          <span>404</span>
          <h1>Portfolio introuvable</h1>
          <p>Ce portfolio n’existe pas ou n’est plus publié.</p>
          <a href="/">Retour à l’accueil</a>
        </div>
      </main>
    )
  }
  if (state.status === "error") {
    return <main className="portfolio-public-state" role="alert">{state.message}</main>
  }

  const publicData = state.portfolio.data
  const data: PortfolioData = {
    ...publicData,
    email: publicData.email ?? "",
    phone: publicData.phone ?? "",
    contactVisibility: {
      email: Boolean(publicData.email),
      phone: Boolean(publicData.phone),
    },
  }
  const apiBase = (
    (import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ||
    "http://localhost:3000/api"
  ).replace(/\/$/, "")
  const cvDownloadUrl = `${apiBase}/public/portfolio/${encodeURIComponent(state.portfolio.slug)}/cv`

  return (
    <main className="portfolio-full-preview">
      <iframe
        title={`Portfolio public de ${data.fullName}`}
        srcDoc={createPortfolioPreviewSrcDoc(data, state.portfolio.templateId, cvDownloadUrl)}
        sandbox=""
      />
    </main>
  )
}
