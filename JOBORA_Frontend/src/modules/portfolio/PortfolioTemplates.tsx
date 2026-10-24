import type { CSSProperties } from "react"
import { createElement, type ComponentType } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { getContrastTextColor } from "./portfolioColor.ts"
import type {
  PortfolioData,
  PortfolioSectionId,
  PortfolioTemplateId,
  SectionConfig,
  Theme,
} from "../../api/portfolioApi"

export interface PortfolioTemplateProps {
  data: PortfolioData
  sections: SectionConfig[]
  theme: Theme
}

type PortfolioAccentStyle = CSSProperties & {
  "--accent": string
  "--accent-foreground": "#000000" | "#ffffff"
}

const SECTION_LABELS: Record<PortfolioSectionId, string> = {
  home: "Accueil",
  about: "À propos",
  skills: "Compétences",
  experiences: "Expériences",
  projects: "Projets",
  certifications: "Certifications",
  contact: "Contact",
}

function getInitials(fullName: string): string {
  return fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toLocaleUpperCase())
    .join("")
}

function hasSectionContent(id: PortfolioSectionId, data: PortfolioData): boolean {
  switch (id) {
    case "home":
      return Boolean(data.fullName.trim() || data.title.trim() || data.headline.trim())
    case "about":
      return Boolean(data.about.trim())
    case "skills": {
      const skillGroups = [
        data.skills.languages,
        data.skills.frameworks,
        data.skills.tools,
        data.skills.databases,
        data.skills.other,
      ]
      return skillGroups.some((values) => values.some((value) => value.trim()))
    }
    case "experiences":
      return data.experiences.some((item) => [item.company, item.role, item.description].some((value) => value.trim()))
    case "projects":
      return data.projects.some((item) => [item.name, item.description].some((value) => value.trim()))
    case "certifications":
      return data.certifications.some((item) => [item.name, item.issuer, item.year].some((value) => value.trim()))
    case "contact":
      return Boolean(
        (data.contactVisibility.email && data.email.trim()) ||
        (data.contactVisibility.phone && data.phone.trim()) ||
        data.location.trim() ||
        data.links.linkedin.trim() ||
        data.links.github.trim() ||
        data.links.website.trim(),
      )
  }
}

function renderSection(id: PortfolioSectionId, data: PortfolioData, projectsVisible: boolean) {
  switch (id) {
    case "home":
      return (
        <section className="template-home" id={id} key={id}>
          {data.availableForWork && <span className="template-availability">Disponible pour une opportunité</span>}
          {data.fullName && <p className="template-name">{data.fullName}</p>}
          {data.title && <p className="template-title">{data.title}</p>}
          {data.headline && <h2>{data.headline}</h2>}
          {projectsVisible && data.projects.length > 0 && (
            <a className="template-projects-button" href="#projects">Voir mes projets</a>
          )}
          {data.showCvDownload && (
            <a className="template-cv-button" href="/api/portfolio/me/cv">Télécharger mon CV</a>
          )}
        </section>
      )
    case "about":
      return <section key={id} id={id}><h3>À propos</h3><p>{data.about}</p></section>
    case "skills":
      return (
        <section key={id} id={id}>
          <h3>Compétences</h3>
          <div className="template-tags">
            {Object.values(data.skills).flat().map((skill, index) => (
              <span key={`${skill}-${index}`}>{skill}</span>
            ))}
          </div>
        </section>
      )
    case "experiences":
      return (
        <section key={id} id={id}>
          <h3>Expériences</h3>
          <div className="template-entry-list">
            {data.experiences.map((experience, index) => (
              <article key={`${experience.company}-${index}`}>
                <strong>{experience.role || experience.company}</strong>
                {experience.role && <span>{experience.company}</span>}
                {(experience.startDate || experience.endDate) && (
                  <small>{[experience.startDate, experience.endDate].filter(Boolean).join(" – ")}</small>
                )}
                {experience.description && <p>{experience.description}</p>}
              </article>
            ))}
          </div>
        </section>
      )
    case "projects":
      return (
        <section key={id} id={id}>
          <h3>Projets</h3>
          <div className="template-entry-list">
            {data.projects.map((project, index) => (
              <article key={`${project.name}-${index}`}>
                <strong>{project.name}</strong>
                {project.year && <small>{project.year}</small>}
                {project.description && <p>{project.description}</p>}
                {project.technologies.length > 0 && (
                  <div className="template-tags">
                    {project.technologies.map((technology) => <span key={technology}>{technology}</span>)}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      )
    case "certifications":
      return (
        <section key={id} id={id}>
          <h3>Certifications</h3>
          <div className="template-entry-list">
            {data.certifications.map((certification, index) => (
              <article key={`${certification.name}-${index}`}>
                <strong>{certification.name}</strong>
                {certification.issuer && <span>{certification.issuer}</span>}
                {certification.year && <small>{certification.year}</small>}
              </article>
            ))}
          </div>
        </section>
      )
    case "contact":
      return (
        <section key={id} id={id}>
          <h3>Contact</h3>
          <div className="template-contact">
            {data.email && data.contactVisibility.email && <span>{data.email}</span>}
            {data.phone && data.contactVisibility.phone && <span>{data.phone}</span>}
            {data.location && <span>{data.location}</span>}
            {data.links.linkedin && <span>{data.links.linkedin}</span>}
            {data.links.github && <span>{data.links.github}</span>}
            {data.links.website && <span>{data.links.website}</span>}
          </div>
        </section>
      )
  }
}

function TemplateLayout({
  variant,
  data,
  sections,
  theme,
}: PortfolioTemplateProps & { variant: PortfolioTemplateId }) {
  const visibleSections = sections
    .filter((section) => section.visible)
    .sort((left, right) => left.order - right.order)
  const renderedSections = visibleSections
    .filter((section) => hasSectionContent(section.id, data))
    .map((section) => renderSection(
      section.id,
      data,
      visibleSections.some((visibleSection) => visibleSection.id === "projects"),
    ))
    .filter((section) => section !== null)

  return (
    <div
      className={`website website-${variant}`}
      style={{
        "--accent": theme.accentColor,
        "--accent-foreground": getContrastTextColor(theme.accentColor),
      } as PortfolioAccentStyle}
    >
      {visibleSections.length > 0 && (
        <nav aria-label="Sections du portfolio">
          <strong>{getInitials(data.fullName)}</strong>
          <div>
            {visibleSections.map((section) => (
              <span key={section.id}>{SECTION_LABELS[section.id]}</span>
            ))}
          </div>
        </nav>
      )}
      {renderedSections}
    </div>
  )
}

export function DeveloperTemplate(props: PortfolioTemplateProps) {
  return <TemplateLayout variant="developer" {...props} />
}

export function StudentTemplate(props: PortfolioTemplateProps) {
  return <TemplateLayout variant="student" {...props} />
}

export function MinimalTemplate(props: PortfolioTemplateProps) {
  return <TemplateLayout variant="minimal" {...props} />
}

export function ModernTemplate(props: PortfolioTemplateProps) {
  return <TemplateLayout variant="modern" {...props} />
}

export function ProfessionalTemplate(props: PortfolioTemplateProps) {
  return <TemplateLayout variant="professional" {...props} />
}

export const PORTFOLIO_TEMPLATES: Record<PortfolioTemplateId, ComponentType<PortfolioTemplateProps>> = {
  developer: DeveloperTemplate,
  student: StudentTemplate,
  minimal: MinimalTemplate,
  modern: ModernTemplate,
  professional: ProfessionalTemplate,
}

const PORTFOLIO_PREVIEW_STYLES = `
  :root { color-scheme:light; }
  * { box-sizing:border-box; }
  html,body { background:#f1f3f8; }
  body { margin:0; padding:24px; color:#1b2740; font:14px/1.6 Inter,Arial,sans-serif; }
  .website { --accent:#5b5bd6; max-width:1280px; min-height:100vh; margin:0 auto; padding-bottom:48px; background:#fff; overflow:hidden; }
  .website nav { display:flex; justify-content:space-between; align-items:center; padding:25px 6%; border-bottom:1px solid #edf0f5; }
  .website nav strong { color:var(--accent); font-size:22px; }
  .website nav div { display:flex; flex-wrap:wrap; gap:20px; font-size:12px; }
  .website nav span { color:#526077; }
  .website > section { padding:28px 8%; }
  .website > section h2 { max-width:850px; margin:18px 0; color:var(--accent); font-size:clamp(28px,4vw,52px); line-height:1.1; }
  .website > section h3 { margin:0 0 12px; color:var(--accent); font-size:20px; }
  .website > section p { max-width:720px; color:#667085; line-height:1.7; }
  .website > section.template-home { max-width:1000px; padding-top:70px; padding-bottom:56px; }
  .website .template-name { margin:16px 0 4px; color:#1b2740; font-size:18px; font-weight:700; }
  .website .template-title { margin:0; }
  .template-availability { display:inline-block; padding:7px 11px; border-radius:999px; background:#e8f7f3; color:#087f69; font-size:12px; }
  .template-projects-button,.template-cv-button { display:inline-block; margin:8px 8px 0 0; padding:10px 14px; border:1px solid var(--accent); border-radius:8px; background:var(--accent); color:var(--accent-foreground); text-decoration:none; }
  .template-tags,.template-contact { display:flex; flex-wrap:wrap; gap:8px; }
  .template-tags span { padding:5px 9px; border-radius:999px; background:color-mix(in srgb,var(--accent) 10%,white); color:var(--accent); font-size:12px; }
  .template-entry-list { display:grid; gap:14px; }
  .template-entry-list article { display:grid; gap:4px; padding-left:14px; border-left:2px solid color-mix(in srgb,var(--accent) 55%,white); }
  .template-entry-list strong { color:#26334b; }
  .template-entry-list span,.template-entry-list small { color:#667085; font-size:12px; }
  .template-entry-list p { margin:3px 0; }
  .template-contact span { color:#526077; }
  .website-student { background:#fffaf3; }
  .website-student nav { border-bottom-color:#f0e3d1; }
  .website-student .template-entry-list article { border-left-style:dashed; }
  .website-minimal { border:1px solid #ececec; color:#202020; }
  .website-minimal nav { padding-top:34px; }
  .website-minimal .template-tags span { border:1px solid color-mix(in srgb,var(--accent) 35%,white); border-radius:3px; background:transparent; }
  .website-modern { background:linear-gradient(150deg,color-mix(in srgb,var(--accent) 5%,white),white 42%); }
  .website-modern nav { border-bottom:0; }
  .website-modern > section.template-home { padding-top:84px; }
  .website-professional nav { background:#f7f8fa; }
  .website-professional > section { border-bottom:1px solid #edf0f5; }
  @media(max-width:600px) { body { padding:0; } .website nav div { display:none; } .website > section.template-home { padding-top:38px; } }
`

export function createPortfolioPreviewSrcDoc(
  data: PortfolioData,
  templateId: PortfolioTemplateId,
  cvDownloadUrl?: string,
): string {
  const Template = PORTFOLIO_TEMPLATES[templateId]
  const renderedMarkup = renderToStaticMarkup(createElement(Template, {
    data,
    sections: data.sections,
    theme: data.theme,
  }))
  const markup = cvDownloadUrl
    ? renderedMarkup.replace('href="/api/portfolio/me/cv"', `href="${escapeAttribute(cvDownloadUrl)}"`)
    : renderedMarkup
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${PORTFOLIO_PREVIEW_STYLES}</style></head><body>${markup}</body></html>`
}

export function createStandalonePortfolioHtml(
  data: PortfolioData,
  templateId: PortfolioTemplateId,
): string {
  const accentColor = /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(data.theme.accentColor)
    ? data.theme.accentColor
    : "#5b5bd6"
  const safeData: PortfolioData = {
    ...data,
    theme: { accentColor },
  }
  const Template = PORTFOLIO_TEMPLATES[templateId]
  const markup = renderToStaticMarkup(createElement(Template, {
    data: safeData,
    sections: safeData.sections,
    theme: safeData.theme,
  }))
  const title = safeData.fullName.trim()
    ? `${safeData.fullName.trim()} — Portfolio`
    : safeData.title.trim() || "Portfolio"
  const description = (safeData.headline || safeData.about || safeData.title || "Découvrez ce portfolio.")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200)

  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <style>${PORTFOLIO_PREVIEW_STYLES}</style>
</head>
<body>${markup}</body>
</html>`
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
