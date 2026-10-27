import { useEffect, useState, type FormEvent } from "react"
import { ArrowRight, BriefcaseBusiness, FileCheck2, GraduationCap, LoaderCircle, RefreshCw, Sparkles, Upload } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { AINotice, Badge, Button, Card, PageTitle, Progress, Select, Textarea } from "../../components/ui"
import { ApiError, protectedRequest } from "../../services/api"
import type { CV } from "../cv/types"
import { matchingService, type MatchingResult } from "./matchingService"

function messageFor(error: unknown) {
  return error instanceof ApiError ? error.message : "L’analyse n’a pas pu aboutir. Réessaie."
}

export default function MatchingPage() {
  const navigate = useNavigate()
  const [cvs, setCvs] = useState<CV[]>([])
  const [cvId, setCvId] = useState("")
  const [jobDescription, setJobDescription] = useState("")
  const [result, setResult] = useState<MatchingResult | null>(null)
  const [loadingCvs, setLoadingCvs] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    let active = true
    protectedRequest<CV[]>("/cvs").then((items) => {
      if (!active) return
      setCvs(items)
      setCvId(items[0]?.id || "")
    }).catch((cause: unknown) => {
      if (active) setError(messageFor(cause))
    }).finally(() => {
      if (active) setLoadingCvs(false)
    })
    return () => { active = false }
  }, [])

  async function analyze(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!cvId) return setError("Choisis un CV enregistré dans ton espace.")
    if (jobDescription.trim().length < 20) return setError("L’offre doit contenir au moins 20 caractères.")
    setBusy(true)
    try {
      setResult(await matchingService.analyze({ cvId, jobDescription: jobDescription.trim() }))
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy(false)
    }
  }

  async function importPdf(file?: File) {
    if (!file) return
    setError("")
    if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) return setError("Choisis un fichier PDF valide.")
    if (file.size > 5 * 1024 * 1024) return setError("Le PDF ne doit pas dépasser 5 Mo.")
    setUploading(true)
    try {
      const { cv } = await matchingService.upload(file)
      setCvs((items) => [cv, ...items])
      setCvId(cv.id)
    } catch (cause) { setError(messageFor(cause)) }
    finally { setUploading(false) }
  }

  const score = result?.compatibility_score ?? 0
  const scoreLabel = score >= 75 ? "Similarité élevée" : score >= 50 ? "Similarité modérée" : "Similarité faible"

  return (
    <>
      <PageTitle
        eyebrow="Module 3 · Matching CV / offre"
        title="Comprends ta compatibilité"
        description="Compare ton CV à une offre grâce à une similarité sémantique SBERT, sans prédire une décision de recrutement."
        action={result ? <Button variant="secondary" onClick={() => setResult(null)}><RefreshCw size={17} /> Nouvelle analyse</Button> : undefined}
      />
      <AINotice />
      <form className="match-input-grid" onSubmit={analyze}>
        <Card>
          <h2>Choisis ton CV JOBORA</h2>
          <p className="muted">Le CV est chargé depuis ton compte. Tes coordonnées personnelles ne sont pas envoyées au modèle de matching.</p>
          <label className="btn btn-secondary" style={{ display: "inline-flex", gap: 8, cursor: uploading ? "wait" : "pointer", marginBottom: 16 }}>
            {uploading ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />} {uploading ? "Analyse du PDF…" : "Importer un CV PDF"}
            <input hidden type="file" accept="application/pdf,.pdf" disabled={uploading || busy} onChange={(event) => { void importPdf(event.target.files?.[0]); event.currentTarget.value = "" }} />
          </label>
          <p className="muted">PDF texte uniquement, maximum 5 Mo. Le contenu extrait est analysé puis enregistré dans ton espace.</p>
          {loadingCvs ? <p role="status"><LoaderCircle className="spin" size={18} /> Chargement des CV…</p> : cvs.length ? (
            <Select label="CV à analyser" value={cvId} onChange={(event) => setCvId(event.target.value)}>
              {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.title || cv.targetJob || "CV sans titre"}</option>)}
            </Select>
          ) : <div className="empty-state"><FileCheck2 size={24} /><h3>Aucun CV enregistré</h3><p>Crée ou importe un CV avant de lancer une analyse.</p><Button type="button" onClick={() => navigate("/app/cv")}>Ouvrir mes CV</Button></div>}
          <div className="match-disclaimer"><strong>À savoir</strong><p>Le score mesure la proximité globale des textes. Il ne vérifie pas séparément les compétences, les diplômes ou la durée d’expérience.</p></div>
        </Card>
        <Card>
          <Textarea label="Offre d’emploi" value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} rows={12} maxLength={30000} placeholder="Colle ici la description complète de l’offre…" hint={`${jobDescription.length} / 30 000 caractères`} />
          <Button type="submit" variant="ai" className="full" loading={busy} disabled={loadingCvs || cvs.length === 0 || jobDescription.trim().length < 20}>Analyser la compatibilité <Sparkles size={17} /></Button>
        </Card>
      </form>
      {error && <div className="card" role="alert" style={{ color: "var(--danger)", marginTop: 16 }}>{error}</div>}
      {result && <>
        <div className="matching-hero">
          <Card className="score-card">
            <div className="match-ring"><div><strong>{Math.round(score)}</strong><span>%</span></div></div>
            <div><Badge tone={score >= 75 ? "success" : score >= 50 ? "warning" : "neutral"}>{scoreLabel}</Badge><h2>{result.compatibility_score.toFixed(2)} % de similarité sémantique</h2><p>Calculée entre le texte de ton CV et cette offre. Ce n’est ni un score ATS ni une probabilité d’embauche.</p></div>
          </Card>
          <Card className="score-explainer">
            <div className="card-heading"><div><h3>Méthode de calcul</h3><p>Encodage des textes, puis similarité cosinus.</p></div><Badge tone="ai"><Sparkles size={12} /> {result.algorithm}</Badge></div>
            <Progress value={score} label={`${result.compatibility_score.toFixed(2)} %`} />
          </Card>
        </div>
        <Card className="criteria-card">
          <div className="card-heading"><div><h2>Suggestions de métiers</h2><p>Les cinq intitulés les plus proches du CV dans la taxonomie de l’analyseur.</p></div></div>
          <div className="weighted-bars">{result.top_job_matches.map((match) => <div key={match.title}><div><span>{match.title}</span><strong>{match.score.toFixed(2)} %</strong></div><Progress value={match.score} /></div>)}</div>
        </Card>
        <div className="next-actions"><h2>Continuer ta préparation</h2><div>
          <Button variant="secondary" onClick={() => navigate("/app/lettre")}><BriefcaseBusiness size={20} /><span><strong>Générer ma lettre</strong><small>Créer une candidature ciblée</small></span><ArrowRight size={17} /></Button>
          <Button variant="secondary" onClick={() => navigate("/app/formations")}><GraduationCap size={20} /><span><strong>Voir mes formations</strong><small>Construire une roadmap de progression</small></span><ArrowRight size={17} /></Button>
        </div></div>
      </>}
    </>
  )
}
