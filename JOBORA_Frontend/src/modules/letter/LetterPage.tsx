import { useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Check, Clock3, Copy, Download, FileText, RefreshCw, Save, Trash2, Upload } from "lucide-react"
import { AINotice, Badge, Button, Card, Field, PageTitle, Select, Textarea } from "../../components/ui"
import { ApiError, readSession } from "../../services/api"
import {
  type CoverLetter,
  type CvOption,
  type LetterLanguage,
  type LetterParagraph,
  type LetterSummary,
  type LetterTone,
  type RewriteAction,
  letterPlainText,
  letterService,
  wordCount,
} from "./letterService"

const TONES: Array<[LetterTone, string]> = [["formel", "Formel"], ["dynamique", "Dynamique"], ["creatif", "Créatif"]]
const ROLE_LABELS: Record<string, string> = {
  introduction: "Introduction",
  experience: "Expériences",
  fit: "Compétences / offre",
  motivation: "Motivation",
}
const ACTION_LABELS: Record<RewriteAction, string> = {
  regenerer: "Rédaction d'une nouvelle version…",
  raccourcir: "Raccourcissement…",
  plus_formel: "Reformulation plus formelle…",
  plus_dynamique: "Reformulation plus dynamique…",
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Une erreur inattendue est survenue."
}

export default function LetterPage() {
  const signature = readSession()?.user.name || ""

  // Paramètres
  const [cvs, setCvs] = useState<CvOption[]>([])
  const [history, setHistory] = useState<LetterSummary[]>([])
  const [source, setSource] = useState<"cv" | "pdf">("cv")
  const [cvId, setCvId] = useState("")
  const [cvText, setCvText] = useState("")
  const [pdfName, setPdfName] = useState("")
  const [offerText, setOfferText] = useState("")
  const [company, setCompany] = useState("")
  const [language, setLanguage] = useState<LetterLanguage>("fr")
  const [tone, setTone] = useState<LetterTone>("formel")

  // Lettre en cours
  const [letter, setLetter] = useState<CoverLetter | null>(null)
  const [draft, setDraft] = useState<LetterParagraph[]>([])
  const [subject, setSubject] = useState("")
  const [dirty, setDirty] = useState(false)
  const [selected, setSelected] = useState(0)
  const [renderKey, setRenderKey] = useState(0)
  const [busy, setBusy] = useState<null | "generate" | "pdf" | "save" | "delete" | RewriteAction>(null)
  const [error, setError] = useState("")
  const [showVersions, setShowVersions] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.allSettled([letterService.cvOptions(), letterService.list()]).then(([cvResult, listResult]) => {
      if (cvResult.status === "fulfilled") {
        setCvs(cvResult.value)
        if (cvResult.value[0]) setCvId(cvResult.value[0].id)
        else setSource("pdf")
      }
      if (listResult.status === "fulfilled") setHistory(listResult.value)
    })
  }, [])

  function load(next: CoverLetter) {
    setLetter(next)
    setDraft(next.paragraphs)
    setSubject(next.subject)
    setDirty(false)
    setRenderKey((k) => k + 1)
    setLanguage(next.language)
    setTone(next.tone)
    setOfferText(next.offerText)
    setCompany(next.company)
  }

  async function refreshHistory() {
    letterService.list().then(setHistory).catch(() => undefined)
  }

  async function run<T>(kind: NonNullable<typeof busy>, task: () => Promise<T>) {
    setBusy(kind)
    setError("")
    try {
      return await task()
    } catch (e) {
      setError(errorMessage(e))
      return undefined
    } finally {
      setBusy(null)
    }
  }

  async function importPdf(file: File | undefined) {
    if (!file) return
    if (file.type !== "application/pdf") return setError("Importe un fichier PDF.")
    const parsed = await run("pdf", () => letterService.parsePdf(file))
    if (parsed) {
      setCvText(parsed.text)
      setPdfName(file.name)
    }
  }

  async function generate() {
    if (offerText.trim().length < 40) return setError("Colle le texte complet de l'offre (40 caractères minimum).")
    if (source === "cv" && !cvId) return setError("Choisis un CV ou importe un PDF.")
    if (source === "pdf" && cvText.trim().length < 80) return setError("Importe d'abord ton CV en PDF.")
    if (dirty && !window.confirm("Tes modifications non enregistrées seront remplacées. Continuer ?")) return
    const result = await run("generate", () =>
      letterService.generate({
        ...(source === "cv" ? { cvId } : { cvText }),
        offerText,
        company,
        language,
        tone,
      }),
    )
    if (result) {
      load(result)
      setSelected(0)
      refreshHistory()
    }
  }

  async function rewrite(action: RewriteAction) {
    if (!letter) return
    if (dirty) {
      const saved = await run("save", () => letterService.save(letter.id, subject, draft))
      if (!saved) return
    }
    const result = await run(action, () => letterService.rewrite(letter.id, selected, action))
    if (result) load(result)
  }

  async function save() {
    if (!letter) return
    const result = await run("save", () => letterService.save(letter.id, subject, draft))
    if (result) {
      load(result)
      refreshHistory()
    }
  }

  async function open(id: string) {
    if (!id) return
    const result = await run("generate", () => letterService.get(id))
    if (result) {
      load(result)
      setSource(result.cvId ? "cv" : "pdf")
      if (result.cvId) setCvId(result.cvId)
    }
  }

  async function remove() {
    if (!letter || !window.confirm("Supprimer définitivement cette lettre ?")) return
    const result = await run("delete", () => letterService.remove(letter.id))
    if (result) {
      setLetter(null)
      setDraft([])
      refreshHistory()
    }
  }

  function editParagraph(index: number, text: string) {
    const clean = text.replace(/\s+/g, " ").trim()
    if (clean === draft[index]?.text) return
    setDraft((current) => current.map((p, i) => (i === index ? { ...p, text: clean } : p)))
    setDirty(true)
  }

  function restore(index: number) {
    if (!letter) return
    const version = letter.versions[index]
    setDraft(version.paragraphs)
    setSubject(version.subject)
    setDirty(true)
    setRenderKey((k) => k + 1)
    setShowVersions(false)
  }

  async function copy() {
    if (!letter) return
    await navigator.clipboard.writeText(letterPlainText({ ...letter, subject }, draft, signature))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const words = wordCount(draft)
  const usedFacts = useMemo(() => {
    const ids = new Set(draft.flatMap((p) => p.sources))
    return (letter?.facts || []).filter((f) => ids.has(f.id))
  }, [draft, letter])
  const selectedSources = new Set(draft[selected]?.sources || [])
  const rewriting = busy && busy in ACTION_LABELS ? ACTION_LABELS[busy as RewriteAction] : ""

  return (
    <>
      <style>{`
        .letter-warnings { margin-top: 16px; display: grid; gap: 8px; }
        .letter-warnings div { display: flex; gap: 8px; align-items: flex-start; font-size: 14px; }
        .letter-paper p[contenteditable] { outline: none; border-radius: 6px; padding: 2px 4px; margin-left: -4px; transition: background .15s; }
        .letter-paper p[contenteditable]:hover { background: rgba(127,127,127,.08); }
        .letter-paper p.is-selected { background: rgba(124,92,255,.10); box-shadow: inset 3px 0 0 rgba(124,92,255,.7); }
        .letter-source-tabs, .letter-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .letter-fact { font-size: 13px; opacity: .85; }
        .letter-fact.active { opacity: 1; font-weight: 600; }
        .letter-versions { display: grid; gap: 6px; margin-bottom: 12px; }
        .letter-error { color: #c0392b; font-size: 14px; margin: 8px 0; }
        @media print {
          body * { visibility: hidden !important; }
          .letter-paper, .letter-paper * { visibility: visible !important; }
          .letter-paper { position: absolute; inset: 0; padding: 2cm; box-shadow: none; background: #fff; color: #000; }
          .letter-paper p { background: none !important; box-shadow: none !important; }
        }
      `}</style>
      <PageTitle
        eyebrow="Module 4 · Lettre de motivation"
        title="Une lettre personnelle, jamais générique"
        description="Chaque argument est relié à ton parcours et aux exigences de l’offre."
        action={
          <>
            <Button variant="secondary" disabled={!letter?.versions.length} onClick={() => setShowVersions((v) => !v)}>
              <Clock3 size={17} /> Versions{letter?.versions.length ? ` (${letter.versions.length})` : ""}
            </Button>
            <Button disabled={!letter} onClick={() => window.print()}>
              <Download size={17} /> Exporter PDF
            </Button>
          </>
        }
      />
      <AINotice />
      <div className="letter-layout">
        <Card className="letter-settings">
          <h2>Paramètres</h2>
          {history.length > 0 && (
            <Select label="Mes lettres" value={letter?.id || ""} onChange={(e) => open(e.target.value)}>
              <option value="">Nouvelle lettre</option>
              {history.map((h) => <option key={h.id} value={h.id}>{h.title}</option>)}
            </Select>
          )}

          <div className="field">
            <span className="field-label">Source du CV</span>
            <div className="tone-options">
              <button className={source === "cv" ? "selected" : ""} disabled={!cvs.length} onClick={() => setSource("cv")}>Mes CV JOBORA</button>
              <button className={source === "pdf" ? "selected" : ""} onClick={() => setSource("pdf")}>Importer un PDF</button>
            </div>
          </div>
          {source === "cv" ? (
            <Select label="CV utilisé" value={cvId} onChange={(e) => setCvId(e.target.value)}
              options={cvs.map((cv): [string, string] => [cv.id, `${cv.title}${cv.status === "generated" ? " · généré" : " · brouillon"}`])} />
          ) : (
            <div className="field">
              <input ref={fileInput} type="file" accept="application/pdf" hidden onChange={(e) => importPdf(e.target.files?.[0])} />
              <Button variant="secondary" className="full" loading={busy === "pdf"} onClick={() => fileInput.current?.click()}>
                <Upload size={16} /> {pdfName || "Choisir mon CV (PDF)"}
              </Button>
              <span className="field-hint">Nom, email, téléphone et liens sont retirés avant l’envoi à l’IA.</span>
            </div>
          )}

          <Textarea label="Offre ciblée" rows={7} value={offerText} maxLength={8000}
            placeholder="Colle ici le texte complet de l’offre d’emploi…" onChange={(e) => setOfferText(e.target.value)} />
          <Field label="Entreprise (facultatif)" value={company} maxLength={120} placeholder="Ex. Novalys"
            onChange={(e) => setCompany(e.target.value)} />
          <Select label="Langue" value={language} onChange={(e) => setLanguage(e.target.value as LetterLanguage)}
            options={[["fr", "Français"], ["en", "Anglais"]]} />
          <div className="field">
            <span className="field-label">Ton de la lettre</span>
            <div className="tone-options">
              {TONES.map(([value, label]) => (
                <button key={value} className={tone === value ? "selected" : ""} onClick={() => setTone(value)}>{label}</button>
              ))}
            </div>
          </div>

          <Button variant="ai" className="full" loading={busy === "generate"} disabled={!!busy && busy !== "generate"} onClick={generate}>
            {busy === "generate" ? "Rédaction en cours (1 à 2 min)…" : letter ? "Régénérer la lettre" : "Générer la lettre"}
          </Button>
          {error && <p className="letter-error">{error}</p>}

          {letter && (
            <div className="source-summary">
              <strong>Sources utilisées</strong>
              <span><FileText size={14} /> {letter.cvTitle}</span>
              {usedFacts.map((fact) => (
                <span key={fact.id} className={`letter-fact ${selectedSources.has(fact.id) ? "active" : ""}`} title={fact.text}>
                  <Check size={14} /> [{fact.id}] {fact.label}
                </span>
              ))}
              {letter.matchedSkills.length > 0 && (
                <>
                  <strong>Exigences couvertes</strong>
                  <div className="letter-chips">{letter.matchedSkills.map((s) => <Badge key={s} tone="success">{s}</Badge>)}</div>
                </>
              )}
              {letter.missingSkills.length > 0 && (
                <>
                  <strong>Absentes du CV (non revendiquées)</strong>
                  <div className="letter-chips">{letter.missingSkills.map((s) => <Badge key={s} tone="warning">{s}</Badge>)}</div>
                </>
              )}
            </div>
          )}
        </Card>

        <Card className="editor-card">
          <div className="editor-toolbar">
            <div>
              <button title="Enregistrer" disabled={!letter || !dirty || !!busy} onClick={save}><Save size={16} /></button>
              <button title="Copier le texte" disabled={!letter} onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              <button title="Supprimer" disabled={!letter || !!busy} onClick={remove}><Trash2 size={16} /></button>
              <i />
              {letter && <Badge tone={dirty ? "warning" : "success"}>{dirty ? "Modifications non enregistrées" : "Enregistrée"}</Badge>}
            </div>
            <span>{words} mots</span>
          </div>

          {showVersions && letter && (
            <div className="letter-versions">
              {[...letter.versions].map((v, i) => ({ v, i })).reverse().map(({ v, i }) => (
                <Button key={i} variant="ghost" onClick={() => restore(i)}>
                  <RefreshCw size={14} /> {v.label} · {new Date(v.savedAt).toLocaleString("fr-FR")}
                </Button>
              ))}
            </div>
          )}

          {!letter ? (
            <article className="letter-paper">
              <p>Choisis ton CV, colle l’offre, puis clique sur « Générer la lettre ».</p>
              <p>L’IA sélectionne les expériences les plus pertinentes pour l’offre et rédige une lettre en quatre paragraphes, sans inventer de compétence ni de chiffre. Tu pourras modifier chaque paragraphe directement dans cette page.</p>
            </article>
          ) : (
            <article className="letter-paper" key={renderKey}>
              {subject && (
                <p contentEditable suppressContentEditableWarning
                  onBlur={(e) => { const t = e.currentTarget.innerText.replace(/^Objet\s*:\s*/i, "").trim(); if (t !== subject) { setSubject(t); setDirty(true) } }}>
                  <strong>Objet : {subject}</strong>
                </p>
              )}
              <p>{letter.salutation}</p>
              {draft.map((paragraph, index) => (
                <p key={`${renderKey}-${index}`} contentEditable={!busy} suppressContentEditableWarning
                  className={index === selected ? "is-selected" : ""} title={ROLE_LABELS[paragraph.role]}
                  onFocus={() => setSelected(index)} onClick={() => setSelected(index)}
                  onBlur={(e) => editParagraph(index, e.currentTarget.innerText)}>
                  {paragraph.text}
                </p>
              ))}
              <p>{letter.closing}</p>
              <p><strong>{signature}</strong></p>
            </article>
          )}

          {letter && (
            <div className="paragraph-actions">
              <Button variant="secondary" loading={busy === "regenerer"} disabled={!!busy} onClick={() => rewrite("regenerer")}>
                <RefreshCw size={15} /> Régénérer « {ROLE_LABELS[draft[selected]?.role] || "paragraphe"} »
              </Button>
              <Button variant="ghost" loading={busy === "raccourcir"} disabled={!!busy} onClick={() => rewrite("raccourcir")}>Raccourcir</Button>
              <Button variant="ghost" loading={busy === "plus_formel"} disabled={!!busy} onClick={() => rewrite("plus_formel")}>Plus formel</Button>
              <Button variant="ghost" loading={busy === "plus_dynamique"} disabled={!!busy} onClick={() => rewrite("plus_dynamique")}>Plus dynamique</Button>
              {rewriting && <span className="field-hint">{rewriting}</span>}
            </div>
          )}

          {letter && letter.warnings.length > 0 && (
            <div className="letter-warnings">
              <strong>À vérifier avant d’envoyer</strong>
              {letter.warnings.map((w) => (
                <div key={w}><AlertTriangle size={15} /> <span>{w}</span></div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  )
}
