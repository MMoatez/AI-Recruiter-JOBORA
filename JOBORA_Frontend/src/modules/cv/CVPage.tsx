import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Download,
  Eye,
  FileCheck2,
  FilePlus2,
  FileText,
  GraduationCap,
  Languages,
  LoaderCircle,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UserRound,
  WandSparkles,
  Wrench,
  X,
} from "lucide-react"
import {
  AINotice,
  Badge,
  Button,
  Card,
  Field,
  PageTitle,
  Textarea,
} from "../../components/ui"
import { cvService, emptyCV, exportCvToPdf, validateATS } from "./cvService"
import type {
  CV,
  CertificationEntry,
  EducationEntry,
  ExperienceEntry,
  LanguageEntry,
  ProjectEntry,
} from "./types"

type View = "dashboard" | "editor" | "preview"

const steps = [
  { label: "Identité", icon: UserRound },
  { label: "Objectif", icon: Target },
  { label: "Formation", icon: GraduationCap },
  { label: "Expérience", icon: BriefcaseBusiness },
  { label: "Projets", icon: FileText },
  { label: "Compétences", icon: Wrench },
  { label: "Langues", icon: Languages },
  { label: "Certifications", icon: Award },
  { label: "Génération", icon: Sparkles },
]

const makeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`
const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
const displayDate = (value: string) =>
  value
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "—"

function SectionTitle({
  number,
  title,
  description,
}: {
  number: string
  title: string
  description: string
}) {
  return (
    <div className="cv2-section-title">
      <span>{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  )
}

function CVDocument({
  cv,
  editable = false,
  update,
}: {
  cv: CV
  editable?: boolean
  update?: (next: CV) => void
}) {
  const personal = cv.personalInformation
  const contact = [
    personal.location,
    personal.phone,
    personal.email,
    personal.linkedin,
    personal.github,
  ].filter(Boolean)
  return (
    <article className="ats-paper" aria-label="Aperçu du CV ATS">
      <header className="ats-header">
        <h1>
          {personal.firstName || "PRÉNOM"}{" "}
          <strong>{personal.lastName || "NOM"}</strong>
        </h1>
        <p>{cv.targetJob || "POSTE CIBLÉ"}</p>
        <div>
          {contact.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </header>
      {(cv.professionalSummary || editable) && (
        <section>
          <h2>PROFIL PROFESSIONNEL</h2>
          {editable ? (
            <textarea
              value={cv.professionalSummary}
              onChange={(event) =>
                update?.({ ...cv, professionalSummary: event.target.value })
              }
              aria-label="Modifier le profil professionnel"
            />
          ) : (
            <p>{cv.professionalSummary}</p>
          )}
        </section>
      )}
      {cv.experiences.length > 0 && (
        <section>
          <h2>EXPÉRIENCE PROFESSIONNELLE</h2>
          {cv.experiences.map((experience, index) => (
            <div className="ats-entry" key={experience.id}>
              <div className="ats-entry-head">
                <div>
                  <h3>{experience.jobTitle}</h3>
                  <p>
                    {experience.company}
                    {experience.location ? ` · ${experience.location}` : ""}
                  </p>
                </div>
                <time>
                  {experience.startDate} — {experience.endDate || "Aujourd’hui"}
                </time>
              </div>
              {editable ? (
                <textarea
                  value={experience.bulletPoints.join("\n")}
                  onChange={(event) => {
                    const experiences = [...cv.experiences]
                    experiences[index] = {
                      ...experience,
                      bulletPoints: event.target.value
                        .split("\n")
                        .filter(Boolean),
                    }
                    update?.({ ...cv, experiences })
                  }}
                  aria-label={`Modifier l’expérience ${experience.jobTitle}`}
                />
              ) : (
                <ul>
                  {experience.bulletPoints.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
      {cv.education.length > 0 && (
        <section>
          <h2>FORMATION</h2>
          {cv.education.map((education) => (
            <div className="ats-entry" key={education.id}>
              <div className="ats-entry-head">
                <div>
                  <h3>{education.degree}</h3>
                  <p>
                    {education.institution}
                    {education.location ? ` · ${education.location}` : ""}
                  </p>
                </div>
                <time>
                  {education.startDate} — {education.endDate}
                </time>
              </div>
              {education.description && <p>{education.description}</p>}
            </div>
          ))}
        </section>
      )}
      {cv.projects.length > 0 && (
        <section>
          <h2>PROJETS</h2>
          {cv.projects.map((project, index) => (
            <div className="ats-entry" key={project.id}>
              <div className="ats-entry-head">
                <div>
                  <h3>{project.name}</h3>
                  <p>{project.technologies.join(" · ")}</p>
                </div>
                {project.link && <span>{project.link}</span>}
              </div>
              {editable ? (
                <textarea
                  value={project.description}
                  onChange={(event) => {
                    const projects = [...cv.projects]
                    projects[index] = {
                      ...project,
                      description: event.target.value,
                    }
                    update?.({ ...cv, projects })
                  }}
                  aria-label={`Modifier le projet ${project.name}`}
                />
              ) : (
                <p>{project.description}</p>
              )}
            </div>
          ))}
        </section>
      )}
      {cv.technicalSkills.length > 0 && (
        <section>
          <h2>COMPÉTENCES TECHNIQUES</h2>
          <p>{cv.technicalSkills.join(" · ")}</p>
        </section>
      )}
      {cv.tools.length > 0 && (
        <section>
          <h2>OUTILS</h2>
          <p>{cv.tools.join(" · ")}</p>
        </section>
      )}
      {cv.softSkills.length > 0 && (
        <section>
          <h2>COMPÉTENCES HUMAINES</h2>
          <p>{cv.softSkills.join(" · ")}</p>
        </section>
      )}
      {cv.languages.length > 0 && (
        <section>
          <h2>LANGUES</h2>
          <p>
            {cv.languages
              .map((language) => `${language.language} — ${language.level}`)
              .join(" · ")}
          </p>
        </section>
      )}
      {cv.certifications.length > 0 && (
        <section>
          <h2>CERTIFICATIONS</h2>
          {cv.certifications.map((certification) => (
            <p key={certification.id}>
              <strong>{certification.name}</strong> ·{" "}
              {certification.organization} · {certification.date}
            </p>
          ))}
        </section>
      )}
    </article>
  )
}

export default function CVPage() {
  const [view, setView] = useState<View>("dashboard")
  const [records, setRecords] = useState<CV[]>([])
  const [cv, setCV] = useState<CV>(emptyCV())
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    cvService.list().then((items) => {
      setRecords(items)
      setLoading(false)
    })
  }, [])

  const completion = useMemo(() => {
    const checks = [
      Boolean(
        cv.personalInformation.firstName &&
          cv.personalInformation.lastName &&
          cv.personalInformation.email,
      ),
      Boolean(cv.targetJob && cv.careerObjective),
      cv.education.length > 0,
      cv.experiences.length > 0,
      cv.projects.length > 0,
      cv.technicalSkills.length > 0,
      cv.languages.length > 0,
      cv.certifications.length > 0,
      cv.status === "generated",
    ]
    return Math.round((checks.filter(Boolean).length / checks.length) * 100)
  }, [cv])

  function beginCreate() {
    setCV(emptyCV())
    setStep(0)
    setView("editor")
    setError("")
    setNotice("")
  }
  function beginEdit(record: CV) {
    setCV(structuredClone(record))
    setStep(record.status === "generated" ? 8 : 0)
    setView("editor")
    setError("")
    setNotice("")
  }
  async function refresh() {
    setRecords(await cvService.list())
  }
  async function saveCV(message = "Brouillon enregistré") {
    setWorking(true)
    setError("")
    try {
      const saved = await cvService.save(cv)
      setCV(saved)
      await refresh()
      setNotice(message)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Impossible d’enregistrer ce CV.",
      )
    } finally {
      setWorking(false)
    }
  }
  async function removeCV(record: CV) {
    if (
      !window.confirm(
        `Supprimer « ${record.title} » ? Cette action est irréversible.`,
      )
    )
      return
    await cvService.remove(record.id)
    await refresh()
  }
  async function generate() {
    setWorking(true)
    setError("")
    setNotice("")
    try {
      const generated = await cvService.generate(cv)
      setCV(generated)
      await refresh()
      setNotice(
        "CV généré et contrôlé. Relis chaque formulation avant l’export.",
      )
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Le service de génération est indisponible.",
      )
    } finally {
      setWorking(false)
    }
  }
  async function regenerate(
    section: "summary" | "experience" | "project",
    index = 0,
  ) {
    setWorking(true)
    setError("")
    try {
      const next = await cvService.regenerateSection(cv, section, index)
      setCV(next)
      await refresh()
      setNotice("Section reformulée à partir de tes données uniquement.")
    } catch {
      setError("Impossible de reformuler cette section pour le moment.")
    } finally {
      setWorking(false)
    }
  }
  function print(record = cv) {
    setCV(record)
    setView("preview")
    window.setTimeout(() => exportCvToPdf(), 180)
  }

  if (loading)
    return (
      <div className="cv2-loading">
        <LoaderCircle className="spin" />
        <span>Chargement de tes CV…</span>
      </div>
    )
  if (view === "dashboard")
    return (
      <CVDashboard
        records={records}
        beginCreate={beginCreate}
        beginEdit={beginEdit}
        removeCV={removeCV}
        preview={(record) => {
          setCV(record)
          setView("preview")
        }}
        print={print}
      />
    )
  if (view === "preview")
    return (
      <CVPreview
        cv={cv}
        back={() => setView("dashboard")}
        edit={() => beginEdit(cv)}
        print={() => print()}
      />
    )

  return (
    <div className="cv2-editor-page">
      <div className="cv2-editor-top">
        <button
          className="cv2-back"
          onClick={async () => {
            await saveCV()
            setView("dashboard")
          }}
        >
          <ArrowLeft size={17} /> Mes CV
        </button>
        <div>
          <span>Brouillon enregistré localement</span>
          <Button
            variant="secondary"
            loading={working}
            onClick={() => saveCV()}
          >
            <Save size={16} /> Enregistrer
          </Button>
          {cv.status === "generated" && (
            <Button onClick={() => setView("preview")}>
              <Eye size={16} /> Aperçu final
            </Button>
          )}
        </div>
      </div>
      <div className="cv2-mobile-progress">
        <span>
          Étape {step + 1} sur {steps.length}
        </span>
        <strong>{steps[step].label}</strong>
        <div>
          <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      <div className="cv2-editor-layout">
        <aside className="cv2-step-nav">
          <div className="cv2-step-progress">
            <span>{completion}%</span>
            <div>
              <i style={{ width: `${completion}%` }} />
            </div>
            <small>Profil complété</small>
          </div>
          <nav>
            {steps.map(({ label, icon: Icon }, index) => (
              <button
                className={`${index === step ? "active" : ""} ${
                  index < step ? "done" : ""
                }`}
                key={label}
                onClick={() => setStep(index)}
              >
                <span>
                  {index < step ? <Check size={15} /> : <Icon size={16} />}
                </span>
                <span>
                  <small>Étape {index + 1}</small>
                  {label}
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </nav>
          <div className="cv2-safe-note">
            <ShieldCheck size={18} />
            <span>
              <strong>Tu gardes le contrôle</strong>
              <small>Aucune information n’est inventée.</small>
            </span>
          </div>
        </aside>
        <main className="cv2-workspace">
          {error && (
            <div className="cv2-message error">
              <X size={17} /> {error}
            </div>
          )}
          {notice && (
            <div className="cv2-message success">
              <CheckCircle2 size={17} /> {notice}
              <button onClick={() => setNotice("")}>
                <X size={15} />
              </button>
            </div>
          )}
          <Card className="cv2-form-card">
            {renderStep(step, cv, setCV, working, generate, regenerate)}
          </Card>
          <div className="cv2-form-actions">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((value) => Math.max(0, value - 1))}
            >
              <ArrowLeft size={17} /> Retour
            </Button>
            {step < steps.length - 1 ? (
              <Button
                onClick={async () => {
                  await saveCV("Étape enregistrée")
                  setStep((value) => Math.min(steps.length - 1, value + 1))
                }}
              >
                Continuer <ArrowRight size={17} />
              </Button>
            ) : cv.status === "generated" ? (
              <Button onClick={() => setView("preview")}>
                <Eye size={17} /> Voir le CV final
              </Button>
            ) : null}
          </div>
        </main>
        <aside className="cv2-live-preview">
          <div className="cv2-live-head">
            <div>
              <strong>Aperçu en direct</strong>
              <span>Format ATS · 1 colonne</span>
            </div>
            <Badge tone="success">Auto</Badge>
          </div>
          <div className="cv2-paper-scale">
            <CVDocument cv={cv} />
          </div>
        </aside>
      </div>
    </div>
  )
}

function CVDashboard({
  records,
  beginCreate,
  beginEdit,
  removeCV,
  preview,
  print,
}: {
  records: CV[]
  beginCreate: () => void
  beginEdit: (cv: CV) => void
  removeCV: (cv: CV) => void
  preview: (cv: CV) => void
  print: (cv: CV) => void
}) {
  return (
    <>
      <PageTitle
        eyebrow="Module 1 · CV intelligent"
        title="Mes CV"
        description="Crée des CV ciblés, lisibles par les ATS et toujours sous ton contrôle."
        action={
          <Button variant="ai" onClick={beginCreate}>
            <FilePlus2 size={17} /> Créer un nouveau CV
          </Button>
        }
      />
      <div className="cv2-hero card">
        <div className="cv2-hero-copy">
          <Badge tone="ai">
            <Sparkles size={13} /> Assistant CV IA
          </Badge>
          <h2>Un CV pertinent commence par tes vraies expériences.</h2>
          <p>
            L’IA structure et reformule tes informations sans en inventer. Tu
            valides chaque mot avant l’export.
          </p>
          <Button onClick={beginCreate}>
            Commencer mon CV <ArrowRight size={17} />
          </Button>
        </div>
        <div className="cv2-score-demo">
          <span className="cv2-score-ring">
            92<small>/100</small>
          </span>
          <div>
            <strong>Structure ATS</strong>
            <p>Un contrôle clair, basé sur nos propres règles de qualité.</p>
          </div>
        </div>
      </div>
      <div className="cv2-list-head">
        <div>
          <h2>Mes documents</h2>
          <p>
            {records.length} CV enregistré{records.length > 1 ? "s" : ""}
          </p>
        </div>
        <div className="cv2-trust">
          <ShieldCheck size={16} /> Données privées
        </div>
      </div>
      {records.length === 0 ? (
        <Card className="cv2-empty">
          <FilePlus2 size={28} />
          <h3>Crée ton premier CV</h3>
          <p>
            Commence par tes informations essentielles. Tu pourras revenir à
            tout moment.
          </p>
          <Button onClick={beginCreate}>Créer un CV</Button>
        </Card>
      ) : (
        <div className="cv2-grid">
          {records.map((record) => (
            <Card className="cv2-card" key={record.id}>
              <div className="cv2-card-top">
                <span className="cv2-file-icon">
                  <FileText size={22} />
                </span>
                <Badge
                  tone={record.status === "generated" ? "success" : "warning"}
                >
                  {record.status === "generated" ? "Prêt" : "Brouillon"}
                </Badge>
              </div>
              <h3>{record.title}</h3>
              <p>{record.targetJob || "Aucun poste ciblé"}</p>
              <div className="cv2-card-meta">
                <span>Modifié {displayDate(record.updatedAt)}</span>
                {record.atsValidation && (
                  <strong>{record.atsValidation.score}/100 ATS*</strong>
                )}
              </div>
              <div className="cv2-card-actions">
                <Button variant="secondary" onClick={() => preview(record)}>
                  <Eye size={16} /> Aperçu
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => beginEdit(record)}
                  aria-label="Modifier"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => print(record)}
                  aria-label="Télécharger"
                >
                  <Download size={16} />
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => removeCV(record)}
                  aria-label="Supprimer"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <p className="cv2-disclaimer">
        * Score qualité interne fondé sur les règles de cette application. Il ne
        provient d’aucun ATS commercial.
      </p>
    </>
  )
}

function CVPreview({
  cv,
  back,
  edit,
  print,
}: {
  cv: CV
  back: () => void
  edit: () => void
  print: () => void
}) {
  const ats = cv.atsValidation ?? validateATS(cv)
  const labels: Record<string, string> = {
    standardSections: "Sections standard",
    readability: "Lisibilité",
    conciseBulletPoints: "Points concis",
    noGraphics: "Sans graphiques",
    noTables: "Sans tableaux",
    skillsPresent: "Compétences présentes",
  }
  return (
    <div className="cv2-preview-page">
      <div className="cv2-preview-actions no-print">
        <button className="cv2-back" onClick={back}>
          <ArrowLeft size={17} /> Mes CV
        </button>
        <div>
          <Button variant="secondary" onClick={edit}>
            <Pencil size={16} /> Modifier
          </Button>
          <Button onClick={print}>
            <Download size={16} /> Télécharger en PDF
          </Button>
        </div>
      </div>
      <div className="cv2-preview-shell">
        <aside className="no-print">
          <Badge tone={ats.status === "PASS" ? "success" : "warning"}>
            {ats.status === "PASS" ? (
              <CheckCircle2 size={13} />
            ) : (
              <FileCheck2 size={13} />
            )}{" "}
            {ats.status === "PASS" ? "Prêt pour l’export" : "À améliorer"}
          </Badge>
          <h2>Qualité ATS</h2>
          <div className="cv2-big-score">
            {ats.score}
            <small>/100</small>
          </div>
          <p>Score interne, non affilié à un ATS commercial.</p>
          <ul>
            {Object.entries(ats.checks).map(([key, passed]) => (
              <li className={passed ? "passed" : ""} key={key}>
                {passed ? <Check size={14} /> : <X size={14} />}
                {labels[key]}
              </li>
            ))}
          </ul>
        </aside>
        <CVDocument cv={cv} />
      </div>
    </div>
  )
}

function renderStep(
  step: number,
  cv: CV,
  setCV: (cv: CV) => void,
  working: boolean,
  generate: () => void,
  regenerate: (
    section: "summary" | "experience" | "project",
    index?: number,
  ) => void,
) {
  const personal = cv.personalInformation
  const updatePersonal = (key: keyof typeof personal, value: string) =>
    setCV({ ...cv, personalInformation: { ...personal, [key]: value } })
  if (step === 0)
    return (
      <>
        <SectionTitle
          number="01"
          title="Informations personnelles"
          description="Ces coordonnées apparaîtront en haut de ton CV."
        />
        <div className="cv2-form-grid">
          <Field
            label="Prénom *"
            value={personal.firstName}
            onChange={(e) => updatePersonal("firstName", e.target.value)}
            placeholder="Thomas"
            required
          />
          <Field
            label="Nom *"
            value={personal.lastName}
            onChange={(e) => updatePersonal("lastName", e.target.value)}
            placeholder="Martin"
            required
          />
          <Field
            label="Email *"
            type="email"
            value={personal.email}
            onChange={(e) => updatePersonal("email", e.target.value)}
            placeholder="prenom@email.fr"
            required
          />
          <Field
            label="Téléphone"
            value={personal.phone}
            onChange={(e) => updatePersonal("phone", e.target.value)}
          />
          <Field
            label="Localisation"
            value={personal.location}
            onChange={(e) => updatePersonal("location", e.target.value)}
          />
          <Field
            label="LinkedIn"
            value={personal.linkedin}
            onChange={(e) => updatePersonal("linkedin", e.target.value)}
          />
          <Field
            label="GitHub"
            value={personal.github}
            onChange={(e) => updatePersonal("github", e.target.value)}
          />
        </div>
      </>
    )
  if (step === 1)
    return (
      <>
        <SectionTitle
          number="02"
          title="Objectif professionnel"
          description="Aide l’IA à adapter le vocabulaire au poste visé."
        />
        <Field
          label="Titre du CV"
          value={cv.title}
          onChange={(e) => setCV({ ...cv, title: e.target.value })}
        />
        <Field
          label="Poste ciblé *"
          value={cv.targetJob}
          onChange={(e) => setCV({ ...cv, targetJob: e.target.value })}
          placeholder="Développeur Full-Stack Junior"
        />
        <Textarea
          label="Objectif de carrière"
          rows={6}
          value={cv.careerObjective}
          onChange={(e) => setCV({ ...cv, careerObjective: e.target.value })}
          placeholder="Décris le type de poste, d’équipe ou de missions que tu recherches…"
          hint="Reste factuel : cette information sert de contexte, pas de consigne pour l’IA."
        />
      </>
    )
  if (step === 2)
    return (
      <RepeatSection
        title="Formation"
        description="Ajoute tes diplômes et études, du plus récent au plus ancien."
        addLabel="Ajouter une formation"
        items={cv.education}
        onAdd={() =>
          setCV({
            ...cv,
            education: [
              ...cv.education,
              {
                id: makeId(),
                degree: "",
                institution: "",
                location: "",
                startDate: "",
                endDate: "",
                description: "",
              },
            ],
          })
        }
        onRemove={(index) =>
          setCV({
            ...cv,
            education: cv.education.filter((_, i) => i !== index),
          })
        }
      >
        {(item: EducationEntry, index) => (
          <>
            <div className="cv2-form-grid">
              <Field
                label="Diplôme"
                value={item.degree}
                onChange={(e) =>
                  updateArray(cv, setCV, "education", index, {
                    degree: e.target.value,
                  })
                }
              />
              <Field
                label="Établissement"
                value={item.institution}
                onChange={(e) =>
                  updateArray(cv, setCV, "education", index, {
                    institution: e.target.value,
                  })
                }
              />
              <Field
                label="Localisation"
                value={item.location}
                onChange={(e) =>
                  updateArray(cv, setCV, "education", index, {
                    location: e.target.value,
                  })
                }
              />
              <Field
                label="Date de début"
                value={item.startDate}
                onChange={(e) =>
                  updateArray(cv, setCV, "education", index, {
                    startDate: e.target.value,
                  })
                }
              />
              <Field
                label="Date de fin"
                value={item.endDate}
                onChange={(e) =>
                  updateArray(cv, setCV, "education", index, {
                    endDate: e.target.value,
                  })
                }
              />
            </div>
            <Textarea
              label="Description"
              rows={3}
              value={item.description}
              onChange={(e) =>
                updateArray(cv, setCV, "education", index, {
                  description: e.target.value,
                })
              }
            />
          </>
        )}
      </RepeatSection>
    )
  if (step === 3)
    return (
      <RepeatSection
        title="Expériences et stages"
        description="Décris simplement ce que tu as réellement fait. L’IA se charge de la formulation."
        addLabel="Ajouter une expérience"
        items={cv.experiences}
        onAdd={() =>
          setCV({
            ...cv,
            experiences: [
              ...cv.experiences,
              {
                id: makeId(),
                jobTitle: "",
                company: "",
                location: "",
                startDate: "",
                endDate: "",
                rawDescription: "",
                bulletPoints: [],
              },
            ],
          })
        }
        onRemove={(index) =>
          setCV({
            ...cv,
            experiences: cv.experiences.filter((_, i) => i !== index),
          })
        }
      >
        {(item: ExperienceEntry, index) => (
          <>
            <div className="cv2-form-grid">
              <Field
                label="Intitulé du poste"
                value={item.jobTitle}
                onChange={(e) =>
                  updateArray(cv, setCV, "experiences", index, {
                    jobTitle: e.target.value,
                  })
                }
              />
              <Field
                label="Entreprise"
                value={item.company}
                onChange={(e) =>
                  updateArray(cv, setCV, "experiences", index, {
                    company: e.target.value,
                  })
                }
              />
              <Field
                label="Localisation"
                value={item.location}
                onChange={(e) =>
                  updateArray(cv, setCV, "experiences", index, {
                    location: e.target.value,
                  })
                }
              />
              <Field
                label="Date de début"
                value={item.startDate}
                onChange={(e) =>
                  updateArray(cv, setCV, "experiences", index, {
                    startDate: e.target.value,
                  })
                }
              />
              <Field
                label="Date de fin"
                value={item.endDate}
                onChange={(e) =>
                  updateArray(cv, setCV, "experiences", index, {
                    endDate: e.target.value,
                  })
                }
              />
            </div>
            <Textarea
              label="Ce que tu as fait"
              rows={5}
              value={item.rawDescription}
              onChange={(e) =>
                updateArray(cv, setCV, "experiences", index, {
                  rawDescription: e.target.value,
                })
              }
            />
            {cv.status === "generated" && (
              <Button
                variant="ai"
                loading={working}
                onClick={() => regenerate("experience", index)}
              >
                <RotateCcw size={16} /> Reformuler cette expérience
              </Button>
            )}
          </>
        )}
      </RepeatSection>
    )
  if (step === 4)
    return (
      <RepeatSection
        title="Projets"
        description="Présente les projets qui prouvent tes compétences."
        addLabel="Ajouter un projet"
        items={cv.projects}
        onAdd={() =>
          setCV({
            ...cv,
            projects: [
              ...cv.projects,
              {
                id: makeId(),
                name: "",
                description: "",
                technologies: [],
                link: "",
              },
            ],
          })
        }
        onRemove={(index) =>
          setCV({ ...cv, projects: cv.projects.filter((_, i) => i !== index) })
        }
      >
        {(item: ProjectEntry, index) => (
          <>
            <div className="cv2-form-grid">
              <Field
                label="Nom du projet"
                value={item.name}
                onChange={(e) =>
                  updateArray(cv, setCV, "projects", index, {
                    name: e.target.value,
                  })
                }
              />
              <Field
                label="Lien"
                value={item.link}
                onChange={(e) =>
                  updateArray(cv, setCV, "projects", index, {
                    link: e.target.value,
                  })
                }
              />
              <Field
                className="span-2"
                label="Technologies (séparées par des virgules)"
                value={item.technologies.join(", ")}
                onChange={(e) =>
                  updateArray(cv, setCV, "projects", index, {
                    technologies: splitList(e.target.value),
                  })
                }
              />
            </div>
            <Textarea
              label="Description"
              rows={4}
              value={item.description}
              onChange={(e) =>
                updateArray(cv, setCV, "projects", index, {
                  description: e.target.value,
                })
              }
            />
            {cv.status === "generated" && (
              <Button
                variant="ai"
                loading={working}
                onClick={() => regenerate("project", index)}
              >
                <RotateCcw size={16} /> Reformuler ce projet
              </Button>
            )}
          </>
        )}
      </RepeatSection>
    )
  if (step === 5)
    return (
      <>
        <SectionTitle
          number="06"
          title="Compétences"
          description="Sépare chaque élément par une virgule. N’ajoute que les compétences que tu maîtrises."
        />
        <Textarea
          label="Compétences techniques"
          rows={3}
          value={cv.technicalSkills.join(", ")}
          onChange={(e) =>
            setCV({ ...cv, technicalSkills: splitList(e.target.value) })
          }
        />
        <Textarea
          label="Compétences humaines"
          rows={3}
          value={cv.softSkills.join(", ")}
          onChange={(e) =>
            setCV({ ...cv, softSkills: splitList(e.target.value) })
          }
        />
        <Textarea
          label="Outils"
          rows={3}
          value={cv.tools.join(", ")}
          onChange={(e) => setCV({ ...cv, tools: splitList(e.target.value) })}
        />
      </>
    )
  if (step === 6)
    return (
      <RepeatSection
        title="Langues"
        description="Indique un niveau clair et vérifiable."
        addLabel="Ajouter une langue"
        items={cv.languages}
        onAdd={() =>
          setCV({
            ...cv,
            languages: [
              ...cv.languages,
              { id: makeId(), language: "", level: "" },
            ],
          })
        }
        onRemove={(index) =>
          setCV({
            ...cv,
            languages: cv.languages.filter((_, i) => i !== index),
          })
        }
      >
        {(item: LanguageEntry, index) => (
          <div className="cv2-form-grid">
            <Field
              label="Langue"
              value={item.language}
              onChange={(e) =>
                updateArray(cv, setCV, "languages", index, {
                  language: e.target.value,
                })
              }
            />
            <Field
              label="Niveau"
              value={item.level}
              onChange={(e) =>
                updateArray(cv, setCV, "languages", index, {
                  level: e.target.value,
                })
              }
            />
          </div>
        )}
      </RepeatSection>
    )
  if (step === 7)
    return (
      <RepeatSection
        title="Certifications"
        description="Ajoute uniquement les certifications réellement obtenues."
        addLabel="Ajouter une certification"
        items={cv.certifications}
        onAdd={() =>
          setCV({
            ...cv,
            certifications: [
              ...cv.certifications,
              { id: makeId(), name: "", organization: "", date: "" },
            ],
          })
        }
        onRemove={(index) =>
          setCV({
            ...cv,
            certifications: cv.certifications.filter((_, i) => i !== index),
          })
        }
      >
        {(item: CertificationEntry, index) => (
          <div className="cv2-form-grid">
            <Field
              label="Certification"
              value={item.name}
              onChange={(e) =>
                updateArray(cv, setCV, "certifications", index, {
                  name: e.target.value,
                })
              }
            />
            <Field
              label="Organisme"
              value={item.organization}
              onChange={(e) =>
                updateArray(cv, setCV, "certifications", index, {
                  organization: e.target.value,
                })
              }
            />
            <Field
              label="Date"
              value={item.date}
              onChange={(e) =>
                updateArray(cv, setCV, "certifications", index, {
                  date: e.target.value,
                })
              }
            />
          </div>
        )}
      </RepeatSection>
    )
  return (
    <div className="cv2-generate">
      <div className="cv2-generate-icon">
        <Sparkles size={28} />
      </div>
      <Badge tone="ai">Étape finale</Badge>
      <h2>
        {cv.status === "generated"
          ? "Ton CV est prêt à être relu"
          : "Prêt à transformer ton parcours ?"}
      </h2>
      <p>
        {cv.status === "generated"
          ? "Modifie les textes générés ou régénère seulement la section qui en a besoin."
          : "L’assistant reformule uniquement les informations saisies, puis applique un contrôle ATS déterministe."}
      </p>
      <AINotice />
      {cv.status === "generated" ? (
        <>
          <div className="cv2-edit-generated">
            <label>
              <span>Résumé professionnel</span>
              <textarea
                rows={5}
                value={cv.professionalSummary}
                onChange={(e) =>
                  setCV({ ...cv, professionalSummary: e.target.value })
                }
              />
            </label>
            <Button
              variant="secondary"
              loading={working}
              onClick={() => regenerate("summary")}
            >
              <RotateCcw size={16} /> Régénérer uniquement le résumé
            </Button>
          </div>
          <div className="cv2-generation-result">
            <span className="cv2-score-ring">
              {cv.atsValidation?.score}
              <small>/100</small>
            </span>
            <div>
              <strong>
                {cv.atsValidation?.status === "PASS"
                  ? "Contrôle ATS réussi"
                  : "Quelques améliorations suggérées"}
              </strong>
              <p>
                {cv.atsValidation?.issues[0] ||
                  "Structure claire, sections standard et texte sélectionnable."}
              </p>
            </div>
          </div>
        </>
      ) : (
        <Button
          variant="ai"
          className="cv2-generate-button"
          loading={working}
          onClick={generate}
        >
          <WandSparkles size={18} />{" "}
          {working ? "Génération en cours…" : "Générer mon CV ATS"}
        </Button>
      )}
      <p className="cv2-model-note">
        <ShieldCheck size={14} /> Démonstration locale sécurisée · contrat prêt
        pour Gemini côté serveur
      </p>
    </div>
  )
}

function updateArray<K extends "education" | "experiences" | "projects" | "languages" | "certifications",>(
  cv: CV,
  setCV: (cv: CV) => void,
  key: K,
  index: number,
  patch: Partial<CV[K][number]>,
) {
  const items = [...cv[key]] as Array<CV[K][number]>
  items[index] = { ...items[index], ...patch }
  setCV({ ...cv, [key]: items })
}

function RepeatSection<T>({
  title,
  description,
  addLabel,
  items,
  onAdd,
  onRemove,
  children,
}: {
  title: string
  description: string
  addLabel: string
  items: T[]
  onAdd: () => void
  onRemove: (index: number) => void
  children: (item: T, index: number) => React.ReactNode
}) {
  return (
    <>
      <SectionTitle number="+" title={title} description={description} />
      {items.length === 0 && (
        <div className="cv2-inline-empty">
          <FilePlus2 size={23} />
          <p>Aucune entrée pour le moment.</p>
        </div>
      )}
      {items.map((item, index) => (
        <div className="cv2-repeat" key={(item as { id?: string }).id ?? index}>
          <div className="cv2-repeat-head">
            <strong>
              {title} {index + 1}
            </strong>
            <button
              onClick={() => onRemove(index)}
              aria-label={`Supprimer ${title.toLowerCase()} ${index + 1}`}
            >
              <Trash2 size={16} />
            </button>
          </div>
          {children(item, index)}
        </div>
      ))}
      <Button variant="secondary" className="full" onClick={onAdd}>
        <Plus size={17} /> {addLabel}
      </Button>
    </>
  )
}
