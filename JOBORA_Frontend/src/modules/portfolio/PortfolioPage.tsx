import { useEffect, useRef, useState } from "react"
import {
  Circle,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  GripVertical,
  Monitor,
  Palette,
  RefreshCw,
  Rocket,
  Save,
  Smartphone,
  Tablet,
  UploadCloud,
  X,
} from "lucide-react"
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import JSZip from "jszip"
import { Button, Card, PageTitle } from "../../components/ui"
import type { PortfolioSectionId, SectionConfig } from "../../api/portfolioApi"
import { createPortfolioPreviewSrcDoc, createStandalonePortfolioHtml } from "./PortfolioTemplates"
import PortfolioSectionEditor from "./PortfolioSectionEditor"
import { getContrastTextColor } from "./portfolioColor"
import { usePortfolio } from "./usePortfolio"

const SECTION_LABELS: Record<PortfolioSectionId, string> = {
  home: "Accueil",
  about: "À propos",
  skills: "Compétences",
  experiences: "Expériences",
  projects: "Projets",
  certifications: "Certifications",
  contact: "Contact",
}

const TEMPLATES = [
  { id: "developer", label: "Développeur" },
  { id: "student", label: "Étudiant" },
  { id: "minimal", label: "Minimal" },
  { id: "modern", label: "Moderne" },
  { id: "professional", label: "Professionnel" },
] as const

const ACCENT_COLORS = ["#5b5bd6", "#0f766e", "#be123c", "#c2410c", "#334155"]

export default function PortfolioPage() {
  const [device, setDevice] = useState("desktop")
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [selectedSection, setSelectedSection] = useState<PortfolioSectionId>("home")
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null)
  const [publicationOpen, setPublicationOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [unpublishing, setUnpublishing] = useState(false)
  const [now, setNow] = useState(Date.now())
  const fileInput = useRef<HTMLInputElement>(null)
  const exportMenu = useRef<HTMLDetailsElement>(null)
  const {
    draft,
    isDirty,
    update,
    save,
    sync,
    publish,
    unpublish,
    reset,
    loading,
    saving,
    syncing,
    error,
    hasPortfolio,
    existingCv,
    generating,
    generationStep,
    generate,
    generateFromExistingCv,
    regenerateAbout,
    regeneratingAbout,
    lastSyncedAt,
    status,
    slug,
  } = usePortfolio()
  const templateId = draft.templateId
  const isPublished = status === "published"
  const editorBusy = loading || saving || syncing || exporting || publishing || unpublishing || regeneratingAbout
  const publicUrl = slug ? `${window.location.origin}/p/${encodeURIComponent(slug)}` : ""
  const orderedSections = [...draft.sections].sort((left, right) => left.order - right.order)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const handleSave = async () => {
    const succeeded = await save()
    setToast(succeeded
      ? { type: "success", message: "Portfolio enregistré." }
      : { type: "error", message: "Impossible d’enregistrer le portfolio." })
  }

  const handleSync = async () => {
    const confirmed = window.confirm(
      "Actualiser les données depuis ton CV ? Les études, expériences, projets, compétences et certifications seront synchronisés. Tes textes personnalisés (dont À propos et la phrase d’accroche), ton thème, ton template et tes sections seront conservés.",
    )
    if (!confirmed) return
    const succeeded = await sync()
    setToast(succeeded
      ? { type: "success", message: "Portfolio synchronisé avec ton CV." }
      : { type: "error", message: "La synchronisation a échoué. Consulte le message d’erreur." })
  }

  const handlePublish = async () => {
    if (isPublished && slug) {
      setPublicationOpen(true)
      return
    }
    setPublishing(true)
    const succeeded = await publish()
    setPublishing(false)
    if (succeeded) {
      setPublicationOpen(true)
      setToast({ type: "success", message: "Portfolio publié." })
    } else {
      setToast({ type: "error", message: "La publication a échoué. Consulte le message d’erreur." })
    }
  }

  const handleUnpublish = async () => {
    setUnpublishing(true)
    const succeeded = await unpublish()
    setUnpublishing(false)
    if (succeeded) {
      setPublicationOpen(false)
      setToast({ type: "success", message: "Portfolio dépublié." })
    } else {
      setToast({ type: "error", message: "Impossible de dépublier le portfolio." })
    }
  }

  const handleCopyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl)
      setToast({ type: "success", message: "Lien public copié." })
    } catch {
      setToast({ type: "error", message: "Impossible de copier le lien. Sélectionne et copie l’adresse manuellement." })
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const html = createStandalonePortfolioHtml(draft, templateId)
      const zip = new JSZip()
      zip.file("index.html", html)
      const archive = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 9 },
      })
      const objectUrl = URL.createObjectURL(archive)
      const anchor = document.createElement("a")
      const filename = (draft.fullName || "portfolio")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "portfolio"
      anchor.href = objectUrl
      anchor.download = `${filename}-portfolio.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
      setToast({ type: "success", message: "Archive ZIP du portfolio téléchargée." })
    } catch (exportError) {
      setToast({
        type: "error",
        message: exportError instanceof Error
          ? `L’export a échoué : ${exportError.message}`
          : "L’export du portfolio a échoué.",
      })
    } finally {
      setExporting(false)
      exportMenu.current?.removeAttribute("open")
    }
  }

  const toggleSection = (id: PortfolioSectionId) => {
    update(
      "sections",
      draft.sections.map((section) =>
        section.id === id ? { ...section, visible: !section.visible } : section,
      ),
    )
  }

  const reorderSections = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = orderedSections.findIndex((section) => section.id === active.id)
    const newIndex = orderedSections.findIndex((section) => section.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    update(
      "sections",
      arrayMove(orderedSections, oldIndex, newIndex).map((section, order) => ({ ...section, order })),
    )
  }

  return (
    <>
      <PageTitle
        eyebrow="Module 6 · Portfolio"
        title="Ton travail mérite d’être vu"
        description="Transforme ton CV en portfolio professionnel, personnalisable et prêt à publier."
        action={hasPortfolio ? (
          <>
            <Button variant="secondary" onClick={() => void handleSave()} disabled={editorBusy || !isDirty}>
              <Save size={17} /> {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button
              variant="ai"
              onClick={() => void handlePublish()}
              disabled={editorBusy}
              loading={publishing}
            >
              {isPublished ? <Check size={17} /> : <Rocket size={17} />}
              {isPublished ? "Publié" : "Publier"}
            </Button>
            <details className="portfolio-export-menu" ref={exportMenu}>
              <summary aria-label="Exporter le portfolio">
                <Download size={16} /> Exporter
              </summary>
              <div className="portfolio-export-options">
                <button type="button" onClick={() => void handleExport()} disabled={editorBusy}>
                  <Download size={15} />
                  {exporting ? "Création de l’archive…" : "Télécharger le ZIP"}
                </button>
                <small>Contient index.html avec le style intégré.</small>
              </div>
            </details>
          </>
        ) : undefined}
      />
      {toast && (
        <div className={`portfolio-toast ${toast.type}`} role={toast.type === "error" ? "alert" : "status"}>
          <span>{toast.message}</span>
          <button type="button" aria-label="Fermer la notification" onClick={() => setToast(null)}><X size={15} /></button>
        </div>
      )}
      {error && hasPortfolio !== false && <p role="alert" className="error-message">{error}</p>}
      {loading ? (
        <PortfolioLoadingSkeleton />
      ) : hasPortfolio === false ? (
        <Card className="portfolio-generate-card">
          <div className="portfolio-generate-icon"><UploadCloud size={28} /></div>
          <h2>Crée ton portfolio depuis ton CV</h2>
          <p>
            Importe ton CV PDF pour extraire tes expériences, projets et compétences,
            puis personnalise ton portfolio.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={generating}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null
              setFileError(null)
              if (!file) {
                setSelectedFile(null)
                return
              }
              if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
                setSelectedFile(null)
                setFileError("Choisis un fichier PDF valide.")
                event.currentTarget.value = ""
                return
              }
              if (file.size > 5 * 1024 * 1024) {
                setSelectedFile(null)
                setFileError("Le PDF ne doit pas dépasser 5 Mo.")
                event.currentTarget.value = ""
                return
              }
              setSelectedFile(file)
            }}
          />
          <div className="portfolio-generate-actions">
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
              disabled={generating}
            >
              <FileText size={17} /> Choisir un PDF
            </Button>
            {selectedFile && (
              <span className="portfolio-selected-file">{selectedFile.name}</span>
            )}
            <Button
              variant="ai"
              onClick={() => selectedFile && void generate(selectedFile)}
              disabled={!selectedFile || generating}
              loading={generating}
            >
              Générer le portfolio
            </Button>
          </div>
          {existingCv && (
            <div className="portfolio-existing-cv">
              <span>
                Un CV est déjà enregistré : <strong>{existingCv.title}</strong>
              </span>
              <Button
                variant="ghost"
                onClick={() => void generateFromExistingCv()}
                disabled={generating}
                loading={generating}
              >
                Générer depuis mon CV
              </Button>
            </div>
          )}
          {fileError && <p role="alert" className="field-error">{fileError}</p>}
          {error && <p role="alert" className="field-error">{error}</p>}
          {generating && (
            <div className="portfolio-generation-progress" aria-live="polite" role="status">
              {["Lecture du CV…", "Analyse…", "Rédaction…"].map((step, index) => (
                <p className={generationStep === index ? "active" : generationStep > index ? "done" : ""} key={step}>
                  <Circle size={10} fill={generationStep >= index ? "currentColor" : "none"} />
                  {step}
                </p>
              ))}
            </div>
          )}
        </Card>
      ) : hasPortfolio && (
        <>
          <div className="portfolio-toolbar">
            <div className="template-picker">
              {TEMPLATES.map(({ id, label }, index) => (
                <button
                  className={templateId === id ? "active" : ""}
                  key={id}
                  type="button"
                  aria-pressed={templateId === id}
                  onClick={() => update("templateId", id)}
                  disabled={editorBusy}
                >
                  <span className={`template-thumb t${index}`} />
                  {label}
                </button>
              ))}
            </div>
            {isDirty && (
              <Button variant="ghost" onClick={reset} disabled={editorBusy}>
                Annuler les modifications
              </Button>
            )}
          </div>
          <div className="portfolio-editor">
            <Card className="portfolio-sidebar">
              <div className="sync-card">
                <RefreshCw size={18} />
                <span>
                  <strong>Synchronisé avec ton CV</strong>
                  <small>{lastSyncedAt ? formatRelativeTime(lastSyncedAt, now) : "Jamais synchronisé"}</small>
                </span>
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={editorBusy}
                >
                  <RefreshCw size={13} className={syncing ? "spin" : ""} />
                  {syncing ? "Actualisation…" : "Actualiser"}
                </button>
              </div>
              <h3>Sections</h3>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={reorderSections}>
                <SortableContext
                  items={orderedSections.map((section) => section.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="section-list">
                    {orderedSections.map((section) => (
                      <SortableSectionRow
                        key={section.id}
                        section={section}
                        selected={selectedSection === section.id}
                        onSelect={() => setSelectedSection(section.id)}
                        onToggle={() => toggleSection(section.id)}
                        disabled={editorBusy}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
              <h3>Apparence</h3>
              <div className="color-row">
                {ACCENT_COLORS.map((color) => (
                  <button
                    className={`color ${draft.theme.accentColor === color ? "selected" : ""}`}
                    key={color}
                    type="button"
                    aria-label={`Couleur ${color}`}
                    aria-pressed={draft.theme.accentColor === color}
                    style={{ backgroundColor: color, color: getContrastTextColor(color) }}
                    onClick={() => update("theme.accentColor", color)}
                    disabled={editorBusy}
                  >
                    {draft.theme.accentColor === color && <Check size={14} aria-hidden="true" />}
                  </button>
                ))}
                <label className={`color-picker ${!ACCENT_COLORS.includes(draft.theme.accentColor) ? "selected" : ""}`}>
                  <input
                    type="color"
                    aria-label="Choisir une couleur personnalisée"
                    value={draft.theme.accentColor}
                    onChange={(event) => update("theme.accentColor", event.target.value)}
                    disabled={editorBusy}
                  />
                  <Palette size={15} aria-hidden="true" />
                </label>
              </div>
              <span className="color-picker-value">Accent : {draft.theme.accentColor}</span>
            </Card>
            <Card className="portfolio-section-editor">
              <div className="section-editor-title">
                <span>Modifier la section</span>
                <h2>{SECTION_LABELS[selectedSection]}</h2>
              </div>
              <fieldset className="section-editor-fieldset" disabled={editorBusy}>
                <PortfolioSectionEditor
                  sectionId={selectedSection}
                  draft={draft}
                  update={update}
                  regenerateAbout={regenerateAbout}
                  regeneratingAbout={regeneratingAbout}
                />
              </fieldset>
              {selectedSection === "about" && error && (
                <p className="field-error" role="alert">{error}</p>
              )}
            </Card>
            <div className="portfolio-preview">
              <div className="device-toolbar">
                <span>Aperçu</span>
                <div>
                  <button
                    className={device === "desktop" ? "active" : ""}
                    onClick={() => setDevice("desktop")}
                    aria-label="Aperçu ordinateur"
                    aria-pressed={device === "desktop"}
                  >
                    <Monitor size={17} />
                  </button>
                  <button
                    className={device === "tablet" ? "active" : ""}
                    onClick={() => setDevice("tablet")}
                    aria-label="Aperçu tablette"
                    aria-pressed={device === "tablet"}
                  >
                    <Tablet size={17} />
                  </button>
                  <button
                    className={device === "mobile" ? "active" : ""}
                    onClick={() => setDevice("mobile")}
                    aria-label="Aperçu mobile"
                    aria-pressed={device === "mobile"}
                  >
                    <Smartphone size={17} />
                  </button>
                </div>
                <button type="button" onClick={() => window.open("/portfolio/preview", "_blank", "noopener,noreferrer")}>
                  <ExternalLink size={16} /> Ouvrir
                </button>
              </div>
              <div className="portfolio-preview-viewport">
                <iframe
                  className="portfolio-preview-frame"
                  title={`Aperçu portfolio ${templateId}`}
                  srcDoc={createPortfolioPreviewSrcDoc(draft, templateId)}
                  sandbox=""
                  style={{ width: `${device === "desktop" ? 1280 : device === "tablet" ? 768 : 390}px` }}
                />
              </div>
            </div>
          </div>
        </>
      )}
      {publicationOpen && isPublished && slug && (
        <div
          className="portfolio-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPublicationOpen(false)
          }}
        >
          <section className="portfolio-publish-dialog" role="dialog" aria-modal="true" aria-labelledby="publish-dialog-title">
            <button
              className="portfolio-dialog-close"
              type="button"
              aria-label="Fermer"
              onClick={() => setPublicationOpen(false)}
            >
              <X size={18} />
            </button>
            <div className="portfolio-publish-icon"><Check size={22} /></div>
            <h2 id="publish-dialog-title">Ton portfolio est en ligne</h2>
            <p>Partage ce lien public avec les personnes qui souhaitent découvrir ton travail.</p>
            <div className="portfolio-public-link">
              <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
              <button type="button" aria-label="Copier le lien public" onClick={() => void handleCopyPublicUrl()}>
                <Copy size={17} />
              </button>
            </div>
            <Button variant="danger" onClick={() => void handleUnpublish()} disabled={unpublishing} loading={unpublishing}>
              Dépublier
            </Button>
          </section>
        </div>
      )}
    </>
  )
}

function formatRelativeTime(value: string, now: number): string {
  const timestamp = new Date(value).getTime()
  if (!Number.isFinite(timestamp)) return "Date de synchronisation indisponible"
  const seconds = Math.round((timestamp - now) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ]
  const formatter = new Intl.RelativeTimeFormat("fr", { style: "short", numeric: "auto" })
  for (const [unit, duration] of units) {
    if (Math.abs(seconds) >= duration) return formatter.format(Math.round(seconds / duration), unit)
  }
  return formatter.format(seconds, "second")
}

function SortableSectionRow({
  section,
  selected,
  onSelect,
  onToggle,
  disabled,
}: {
  section: SectionConfig
  selected: boolean
  onSelect: () => void
  onToggle: () => void
  disabled: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id, disabled })

  return (
    <div
      ref={setNodeRef}
      className={`section-list-row ${selected ? "selected" : ""} ${isDragging ? "dragging" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="section-drag-handle"
        type="button"
        aria-label={`Déplacer la section ${SECTION_LABELS[section.id]}`}
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <button
        className="section-select"
        type="button"
        aria-current={selected ? "true" : undefined}
        onClick={onSelect}
        disabled={disabled}
      >
        {SECTION_LABELS[section.id]}
      </button>
      <button
        className={`section-visibility ${section.visible ? "visible" : ""}`}
        type="button"
        aria-label={`${section.visible ? "Masquer" : "Afficher"} ${SECTION_LABELS[section.id]}`}
        aria-pressed={section.visible}
        onClick={onToggle}
        disabled={disabled}
      >
        <Circle size={12} fill={section.visible ? "currentColor" : "none"} />
      </button>
    </div>
  )
}

function PortfolioLoadingSkeleton() {
  return (
    <div className="portfolio-loading" role="status" aria-label="Chargement du portfolio">
      <span className="sr-only">Chargement du portfolio…</span>
      <div className="portfolio-toolbar-skeleton" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="portfolio-editor portfolio-editor-skeleton" aria-hidden="true">
        <div className="portfolio-skeleton-panel">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="portfolio-skeleton-panel">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className="portfolio-skeleton-preview">
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
