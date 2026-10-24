import { useState, type KeyboardEvent, type ReactNode } from "react"
import { Plus, RefreshCw, Trash2, X } from "lucide-react"
import type {
  PortfolioExperience,
  PortfolioProject,
  PortfolioSectionId,
} from "../../api/portfolioApi"
import { Button, Field, Textarea } from "../../components/ui"
import type { PortfolioEditorDraft, PortfolioUpdate } from "./usePortfolio"

const SKILL_CATEGORIES = [
  ["languages", "Langages"],
  ["frameworks", "Frameworks"],
  ["tools", "Outils"],
  ["databases", "Bases de données"],
  ["other", "Autres"],
] as const

const EMPTY_EXPERIENCE: PortfolioExperience = {
  company: "",
  role: "",
  startDate: "",
  endDate: "",
  description: "",
  technologies: [],
}

const EMPTY_PROJECT: PortfolioProject = {
  name: "",
  year: "",
  description: "",
  technologies: [],
}

type Props = {
  sectionId: PortfolioSectionId
  draft: PortfolioEditorDraft
  update: PortfolioUpdate
  regenerateAbout: () => Promise<void>
  regeneratingAbout: boolean
}

export default function PortfolioSectionEditor({
  sectionId,
  draft,
  update,
  regenerateAbout,
  regeneratingAbout,
}: Props) {
  switch (sectionId) {
    case "home":
      return (
        <div className="section-editor-fields">
          <Field label="Nom complet" value={draft.fullName} onChange={(event) => update("fullName", event.target.value)} />
          <Field label="Titre" value={draft.title} onChange={(event) => update("title", event.target.value)} />
          <Field label="Phrase d’accroche" value={draft.headline} onChange={(event) => update("headline", event.target.value)} />
          <label className="section-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.availableForWork}
              onChange={(event) => update("availableForWork", event.target.checked)}
            />
            <span>Disponible pour une opportunité</span>
          </label>
        </div>
      )
    case "about":
      return (
        <div className="section-editor-fields">
          <Textarea
            label="À propos"
            rows={8}
            value={draft.about}
            onChange={(event) => update("about", event.target.value)}
            placeholder="Présente ton parcours et tes objectifs…"
          />
          <Button variant="secondary" onClick={() => void regenerateAbout()} disabled={regeneratingAbout}>
            <RefreshCw size={16} className={regeneratingAbout ? "spin" : ""} />
            {regeneratingAbout ? "Régénération…" : "Régénérer"}
          </Button>
        </div>
      )
    case "skills":
      return (
        <div className="section-editor-fields">
          {SKILL_CATEGORIES.map(([category, label]) => (
            <TagEditor
              key={category}
              label={label}
              tags={draft.skills[category]}
              onChange={(tags) => update(`skills.${category}`, tags)}
            />
          ))}
        </div>
      )
    case "experiences":
      return (
        <EntryListEditor
          heading="Expériences"
          addLabel="Ajouter une expérience"
          items={draft.experiences}
          createItem={() => ({ ...EMPTY_EXPERIENCE, technologies: [] })}
          onChange={(items) => update("experiences", items)}
          renderItem={(item, index, change) => (
            <div className="section-editor-fields">
              <Field label="Poste" value={item.role} onChange={(event) => change({ role: event.target.value })} />
              <Field label="Entreprise" value={item.company} onChange={(event) => change({ company: event.target.value })} />
              <div className="section-editor-grid">
                <Field label="Date de début" value={item.startDate} onChange={(event) => change({ startDate: event.target.value })} />
                <Field label="Date de fin" value={item.endDate} onChange={(event) => change({ endDate: event.target.value })} />
              </div>
              <Textarea label="Description" rows={3} value={item.description} onChange={(event) => change({ description: event.target.value })} />
              <TagEditor
                label="Technologies"
                tags={item.technologies}
                onChange={(technologies) => change({ technologies })}
              />
            </div>
          )}
        />
      )
    case "projects":
      return (
        <EntryListEditor
          heading="Projets"
          addLabel="Ajouter un projet"
          items={draft.projects}
          createItem={() => ({ ...EMPTY_PROJECT, technologies: [] })}
          onChange={(items) => update("projects", items)}
          renderItem={(item, index, change) => (
            <div className="section-editor-fields">
              <Field label="Nom du projet" value={item.name} onChange={(event) => change({ name: event.target.value })} />
              <Field label="Année" value={item.year} onChange={(event) => change({ year: event.target.value })} />
              <Textarea label="Description" rows={3} value={item.description} onChange={(event) => change({ description: event.target.value })} />
              <TagEditor
                label="Technologies"
                tags={item.technologies}
                onChange={(technologies) => change({ technologies })}
              />
            </div>
          )}
        />
      )
    case "certifications":
      return (
        <EntryListEditor
          heading="Certifications"
          addLabel="Ajouter une certification"
          items={draft.certifications}
          createItem={() => ({ name: "", issuer: "", year: "" })}
          onChange={(items) => update("certifications", items)}
          renderItem={(item, _index, change) => (
            <div className="section-editor-fields">
              <Field label="Nom" value={item.name} onChange={(event) => change({ name: event.target.value })} />
              <Field label="Organisme" value={item.issuer} onChange={(event) => change({ issuer: event.target.value })} />
              <Field label="Année" value={item.year} onChange={(event) => change({ year: event.target.value })} />
            </div>
          )}
        />
      )
    case "contact":
      return (
        <div className="section-editor-fields">
          <Field label="Email" type="email" value={draft.email} onChange={(event) => update("email", event.target.value)} />
          <label className="section-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.contactVisibility.email}
              onChange={(event) => update("contactVisibility.email", event.target.checked)}
            />
            <span>Rendre l’email public</span>
          </label>
          <Field label="Téléphone" type="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} />
          <label className="section-editor-checkbox">
            <input
              type="checkbox"
              checked={draft.contactVisibility.phone}
              onChange={(event) => update("contactVisibility.phone", event.target.checked)}
            />
            <span>Rendre le téléphone public</span>
          </label>
          <Field label="LinkedIn" value={draft.links.linkedin} onChange={(event) => update("links.linkedin", event.target.value)} />
          <Field label="GitHub" value={draft.links.github} onChange={(event) => update("links.github", event.target.value)} />
          <Field label="Site web" value={draft.links.website} onChange={(event) => update("links.website", event.target.value)} />
        </div>
      )
  }
}

type EntryListProps<T> = {
  heading: string
  addLabel: string
  items: T[]
  createItem: () => T
  onChange: (items: T[]) => void
  renderItem: (item: T, index: number, change: (patch: Partial<T>) => void) => ReactNode
}

function EntryListEditor<T>({
  heading,
  addLabel,
  items,
  createItem,
  onChange,
  renderItem,
}: EntryListProps<T>) {
  return (
    <div className="section-editor-fields">
      <div className="section-editor-heading">
        <h3>{heading}</h3>
        <Button variant="secondary" onClick={() => onChange([...items, createItem()])}>
          <Plus size={15} /> {addLabel}
        </Button>
      </div>
      {items.map((item, index) => (
        <article className="section-entry-editor" key={index}>
          <div className="section-entry-toolbar">
            <strong>{heading.slice(0, -1)} {index + 1}</strong>
            <button
              type="button"
              aria-label={`Supprimer ${heading.slice(0, -1).toLowerCase()} ${index + 1}`}
              onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {renderItem(item, index, (patch) => {
            onChange(items.map((entry, itemIndex) =>
              itemIndex === index ? { ...entry, ...patch } : entry,
            ))
          })}
        </article>
      ))}
    </div>
  )
}

function TagEditor({
  label,
  tags,
  onChange,
}: {
  label: string
  tags: string[]
  onChange: (tags: string[]) => void
}) {
  const [value, setValue] = useState("")

  const addTag = () => {
    const tag = value.trim()
    if (!tag || tags.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase())) return
    onChange([...tags, tag])
    setValue("")
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" && event.key !== ",") return
    event.preventDefault()
    addTag()
  }

  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <div className="section-tag-list">
        {tags.map((tag, index) => (
          <span className="section-tag" key={`${tag}-${index}`}>
            {tag}
            <button
              type="button"
              aria-label={`Supprimer ${tag}`}
              onClick={() => onChange(tags.filter((_, tagIndex) => tagIndex !== index))}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
      <div className="section-tag-input">
        <input
          aria-label={`Ajouter un élément : ${label}`}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Saisir puis appuyer sur Entrée"
        />
        <button type="button" aria-label={`Ajouter ${label}`} onClick={addTag}><Plus size={16} /></button>
      </div>
    </div>
  )
}
