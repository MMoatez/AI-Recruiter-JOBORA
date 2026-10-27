import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  ArrowRight, BriefcaseBusiness, FileCheck2, LoaderCircle, Plus, RefreshCw, Sparkles, Target, Upload,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  AINotice, Badge, Button, Card, EmptyState, Field, PageTitle, Progress, Select, Stepper, Textarea,
} from "../../components/ui"
import { ApiError, protectedRequest } from "../../services/api"
import type { CV } from "../cv/types"
import { matchingService } from "../matching/matchingService"
import { HistoryPanel } from "./HistoryPanel"
import { ProfileReview } from "./ProfileReview"
import { ResultCard, arrangementLabel } from "./ResultCard"
import { jobMatcherService, pollMatch, scoreLabel, scoreTone, splitList, statusLabel, validateCvFile } from "./jobMatcherService"
import type {
  CandidateProfile, JobMatchResult, JobOffer, MatchResults, MatchSessionSummary, MatchStatus, Seniority, WorkArrangement,
} from "./types"

const STEPS = ["CV", "Profil", "Offres", "Résultats"]

const EMPTY_PROFILE: CandidateProfile = {
  skills: [], experienceYears: null, seniority: "unknown", jobTitles: [], languages: [],
  education: [], certifications: [], preferredLocations: [], workPreferences: [],
}

type JobForm = {
  title: string
  company: string
  description: string
  requiredSkills: string
  preferredSkills: string
  minExperienceYears: string
  seniority: Seniority
  location: string
  workArrangement: WorkArrangement
  contractType: string
}

const EMPTY_JOB_FORM: JobForm = {
  title: "", company: "", description: "", requiredSkills: "", preferredSkills: "",
  minExperienceYears: "", seniority: "unknown", location: "", workArrangement: "unknown", contractType: "",
}

const SENIORITY_OPTIONS: Array<[Seniority, string]> = [
  ["unknown", "Non précisé"], ["junior", "Junior"], ["mid", "Confirmé"], ["senior", "Senior"],
]
const ARRANGEMENT_OPTIONS: Array<[WorkArrangement, string]> = [
  ["unknown", "Non précisé"], ["remote", "Télétravail"], ["hybrid", "Hybride"], ["onsite", "Sur site"],
]
const EXCLUSION_LABELS: Record<string, string> = {
  insufficient_experience: "Expérience insuffisante par rapport à l’exigence du poste",
}

function messageFor(error: unknown) {
  return error instanceof ApiError ? error.message : "La demande n’a pas pu aboutir. Réessaie."
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export default function JobMatcherPage() {
  const navigate = useNavigate()
  const [cvs, setCvs] = useState<CV[]>([])
  const [cvId, setCvId] = useState("")
  const [profile, setProfile] = useState<CandidateProfile | null>(null)
  const [profileCvId, setProfileCvId] = useState("")
  const [jobs, setJobs] = useState<JobOffer[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_JOB_FORM)
  const [results, setResults] = useState<MatchResults | null>(null)
  const [selectedResult, setSelectedResult] = useState<string>("")
  const [history, setHistory] = useState<MatchSessionSummary[]>([])
  const [session, setSession] = useState<MatchStatus | null>(null)
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState<"" | "upload" | "profile" | "job" | "match" | "history">("")
  const [busyId, setBusyId] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  useEffect(() => {
    let active = true
    void Promise.allSettled([
      protectedRequest<CV[]>("/cvs"),
      jobMatcherService.listJobs(),
      jobMatcherService.history(),
    ]).then(([cvsResult, jobsResult, historyResult]) => {
      if (!active) return
      if (cvsResult.status === "fulfilled") {
        setCvs(cvsResult.value)
        setCvId(cvsResult.value[0]?.id ?? "")
      }
      if (jobsResult.status === "fulfilled") {
        setJobs(jobsResult.value)
        setSelectedJobs(jobsResult.value.filter((job) => job.isDemo).map((job) => job.id))
      }
      if (historyResult.status === "fulfilled") setHistory(historyResult.value)
      const failure = [cvsResult, jobsResult, historyResult].find((result) => result.status === "rejected")
      if (failure && failure.status === "rejected") setError(messageFor(failure.reason))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const selectedJobDetails = useMemo(
    () => jobs.find((job) => job.id === selectedResult),
    [jobs, selectedResult],
  )
  const selectedMatch = useMemo(
    () => results?.results.find((match) => match.jobId === selectedResult) ?? null,
    [results, selectedResult],
  )

  function reset() {
    setStep(0)
    setProfile(null)
    setProfileCvId("")
    setResults(null)
    setSelectedResult("")
    setSession(null)
    setError("")
    setNotice("")
  }

  async function uploadCv(file?: File) {
    if (!file) return
    const validation = validateCvFile(file)
    if (validation) return setError(validation)
    setBusy("upload")
    setError("")
    setNotice("")
    try {
      const { cv } = await matchingService.upload(file)
      setCvs((items) => [cv, ...items.filter((item) => item.id !== cv.id)])
      setCvId(cv.id)
      setProfile(null)
      setStep(0)
      setNotice("CV importé. Lance l’analyse du profil pour continuer.")
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy("")
    }
  }

  async function analyzeCv() {
    if (!cvId) return setError("Choisis un CV enregistré dans ton espace.")
    setBusy("profile")
    setError("")
    setNotice("")
    try {
      const { profile: extracted } = await jobMatcherService.extractProfile(cvId)
      setProfile(extracted)
      setProfileCvId(cvId)
      setStep(1)
      setNotice("Profil extrait de ton CV. Vérifie les informations avant de lancer le matching.")
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy("")
    }
  }

  async function saveProfileAndContinue() {
    if (!profile || !profileCvId) return
    setBusy("profile")
    setError("")
    try {
      const saved = await jobMatcherService.saveProfile(profileCvId, profile)
      setProfile(saved.profile)
      setStep(2)
      setNotice("Corrections enregistrées. Sélectionne les offres à comparer.")
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy("")
    }
  }

  function toggleJob(id: string) {
    setSelectedJobs((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function addJob(event: FormEvent) {
    event.preventDefault()
    setError("")
    if (!jobForm.title.trim()) return setError("Renseigne l’intitulé de l’offre.")
    if (jobForm.description.trim().length < 20) return setError("La description doit contenir au moins 20 caractères.")
    setBusy("job")
    try {
      const created = await jobMatcherService.createJob({
        title: jobForm.title.trim(),
        company: jobForm.company.trim() || undefined,
        description: jobForm.description.trim(),
        requiredSkills: splitList(jobForm.requiredSkills),
        preferredSkills: splitList(jobForm.preferredSkills),
        minExperienceYears: jobForm.minExperienceYears === "" ? null : Number(jobForm.minExperienceYears),
        seniority: jobForm.seniority,
        location: jobForm.location.trim() || undefined,
        workArrangement: jobForm.workArrangement,
        contractType: jobForm.contractType.trim() || undefined,
      })
      setJobs((items) => [created, ...items])
      setSelectedJobs((items) => [...items, created.id])
      setJobForm(EMPTY_JOB_FORM)
      setNotice("Offre ajoutée et sélectionnée pour le matching.")
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusy("")
    }
  }

  async function launchMatch() {
    if (!profile || !profileCvId) return setError("Analyse ton CV avant de lancer le matching.")
    if (!selectedJobs.length) return setError("Sélectionne au moins une offre.")
    setBusy("match")
    setError("")
    setNotice("")
    setResults(null)
    setSession(null)
    try {
      const started = await jobMatcherService.startMatch({ cvId: profileCvId, jobIds: selectedJobs, profile })
      setSession({
        id: started.id, cvId: started.cvId, status: started.status, jobCount: started.jobCount,
        createdAt: started.createdAt, updatedAt: started.createdAt,
      })
      const payload = await pollMatch(started.id, undefined, { onStatus: setSession })
      setResults(payload)
      setSelectedResult(payload.results[0]?.jobId ?? "")
      setStep(3)
      setNotice(`Matching terminé : ${payload.results.length} offre${payload.results.length > 1 ? "s" : ""} classée${payload.results.length > 1 ? "s" : ""}.`)
      setHistory(await jobMatcherService.history())
    } catch (cause) {
      setError(messageFor(cause))
      setHistory(await jobMatcherService.history().catch(() => history))
    } finally {
      setBusy("")
      setSession(null)
    }
  }

  async function openHistory(item: MatchSessionSummary) {
    setBusyId(item.id)
    setError("")
    try {
      const payload = await jobMatcherService.getResults(item.id)
      setResults(payload)
      setSelectedResult(payload.results[0]?.jobId ?? "")
      setProfile(null)
      setProfileCvId(payload.cvId)
      setStep(3)
      setNotice(`Résultats du ${formatDate(item.createdAt)}.`)
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusyId("")
    }
  }

  async function removeHistory(item: MatchSessionSummary) {
    if (!window.confirm("Supprimer définitivement ce matching de ton historique ?")) return
    setBusyId(item.id)
    setError("")
    try {
      await jobMatcherService.deleteHistory(item.id)
      setHistory((items) => items.filter((entry) => entry.id !== item.id))
      if (results?.sessionId === item.id) {
        setResults(null)
        setSelectedResult("")
        setStep(2)
      }
      setNotice("Matching supprimé de ton historique.")
    } catch (cause) {
      setError(messageFor(cause))
    } finally {
      setBusyId("")
    }
  }

  const jobCountLabel = `${selectedJobs.length} offre${selectedJobs.length > 1 ? "s" : ""} sélectionnée${selectedJobs.length > 1 ? "s" : ""}`

  return (
    <>
      <PageTitle
        eyebrow="Module · Matching intelligent"
        title="Trouve les offres qui te correspondent vraiment"
        description="Ton CV est comparé à une sélection d’offres : compétences couvertes, expérience, séniorité et analyse sémantique, avec les raisons de chaque score."
        action={step > 0 ? <Button variant="secondary" onClick={reset}><RefreshCw size={17} /> Recommencer</Button> : undefined}
      />
      <AINotice />
      <Stepper steps={STEPS} current={step} />

      {error && <div className="card jm-alert" role="alert">{error}</div>}
      {notice && <div className="card jm-notice" role="status" aria-live="polite">{notice}</div>}

      {step === 0 && (
        <Card className="jm-section">
          <div className="card-heading">
            <div>
              <h2>1. Choisis le CV à analyser</h2>
              <p>Le CV est lu depuis ton espace JOBORA. Les coordonnées personnelles sont retirées avant l’envoi au fournisseur IA.</p>
            </div>
            <Badge tone="neutral"><FileCheck2 size={12} /> PDF · 5 Mo max</Badge>
          </div>
          <label className="btn btn-secondary jm-upload">
            {busy === "upload" ? <LoaderCircle className="spin" size={17} /> : <Upload size={17} />}
            {busy === "upload" ? "Import du PDF…" : "Importer un CV PDF"}
            <input
              hidden
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy !== ""}
              onChange={(event) => {
                void uploadCv(event.target.files?.[0])
                event.currentTarget.value = ""
              }}
            />
          </label>
          {loading ? (
            <p role="status"><LoaderCircle className="spin" size={18} /> Chargement de tes CV…</p>
          ) : cvs.length ? (
            <>
              <Select label="CV enregistré" value={cvId} onChange={(event) => { setCvId(event.target.value); setProfile(null) }}>
                {cvs.map((cv) => <option key={cv.id} value={cv.id}>{cv.title || cv.targetJob || "CV sans titre"}</option>)}
              </Select>
              <Button variant="ai" onClick={analyzeCv} loading={busy === "profile"} disabled={busy !== "" || !cvId}>
                Analyser mon profil <Sparkles size={17} />
              </Button>
            </>
          ) : (
            <EmptyState
              icon={<FileCheck2 size={24} />}
              title="Aucun CV enregistré"
              description="Importe un PDF ou crée ton CV pour lancer une analyse."
              action={<Button onClick={() => navigate("/app/cv")}>Ouvrir mes CV</Button>}
            />
          )}
        </Card>
      )}

      {step === 1 && profile && (
        <ProfileReview
          profile={profile}
          busy={busy === "profile"}
          onChange={(patch) => setProfile((current) => current ? { ...current, ...patch } : current)}
          onContinue={() => { void saveProfileAndContinue() }}
        />
      )}

      {step === 2 && (
        <div className="jm-jobs-layout">
          <Card className="jm-section">
            <div className="card-heading">
              <div>
                <h2>2. Sélectionne les offres</h2>
                <p>Les offres marquées « Démo » sont fictives et servent uniquement à tester le module. Tes offres collées restent privées.</p>
              </div>
              <Badge tone="ai">{jobCountLabel}</Badge>
            </div>
            {jobs.length === 0 ? (
              <EmptyState
                icon={<BriefcaseBusiness size={24} />}
                title="Aucune offre disponible"
                description="Ajoute une description de poste pour lancer une comparaison."
                action={<Button onClick={() => document.getElementById("jm-new-job-title")?.focus()}>Ajouter une offre</Button>}
              />
            ) : (
              <ul className="jm-job-list">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <label className={`jm-job ${selectedJobs.includes(job.id) ? "is-selected" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => toggleJob(job.id)}
                      />
                      <span>
                        <strong>{job.title}</strong>
                        <small>{job.company || "Entreprise non précisée"} · {arrangementLabel[job.workArrangement]}{job.location ? ` · ${job.location}` : ""}</small>
                        {job.minExperienceYears !== null && <small>{job.minExperienceYears} an{job.minExperienceYears > 1 ? "s" : ""} d’expérience requis</small>}
                        <span className="jm-badges">
                          {job.isDemo ? <Badge tone="warning">Offre de démonstration</Badge> : <Badge tone="neutral">Mon offre</Badge>}
                          {job.requiredSkills.slice(0, 4).map((skill) => <Badge key={skill} tone="teal">{skill}</Badge>)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <div className="jm-launch">
              <Button variant="ai" onClick={launchMatch} loading={busy === "match"} disabled={busy !== "" || selectedJobs.length === 0}>
                Lancer le matching <ArrowRight size={17} />
              </Button>
              <p className="muted">Le calcul peut prendre jusqu’à deux minutes. Tu peux suivre son état en direct.</p>
            </div>
            {busy === "match" && (
              <div className="jm-progress" role="status" aria-live="polite">
                <LoaderCircle className="spin" size={18} />
                <span>{session ? `${statusLabel[session.status]} — session ${session.id.slice(0, 12)}…` : "Création de la session de matching…"}</span>
              </div>
            )}
          </Card>

          <Card className="jm-section">
            <div className="card-heading">
              <div>
                <h2>Ajouter une offre</h2>
                <p>Colle une description réelle. Elle n’est pas publiée : elle reste visible uniquement par ton compte.</p>
              </div>
              <Plus size={18} />
            </div>
            <form className="jm-job-form" onSubmit={addJob}>
              <Field id="jm-new-job-title" label="Intitulé du poste" value={jobForm.title} maxLength={200}
                onChange={(event) => setJobForm((form) => ({ ...form, title: event.target.value }))} />
              <Field label="Entreprise" value={jobForm.company} maxLength={200}
                onChange={(event) => setJobForm((form) => ({ ...form, company: event.target.value }))} />
              <Textarea label="Description du poste" rows={8} maxLength={30000} value={jobForm.description}
                hint={`${jobForm.description.length} / 30 000 caractères`}
                placeholder="Colle ici l’offre complète…"
                onChange={(event) => setJobForm((form) => ({ ...form, description: event.target.value }))} />
              <div className="jm-form-grid">
                <Field label="Compétences requises (virgules)" value={jobForm.requiredSkills}
                  onChange={(event) => setJobForm((form) => ({ ...form, requiredSkills: event.target.value }))} />
                <Field label="Compétences appréciées (virgules)" value={jobForm.preferredSkills}
                  onChange={(event) => setJobForm((form) => ({ ...form, preferredSkills: event.target.value }))} />
                <Field label="Expérience minimale (années)" type="number" min={0} max={60} step={0.5}
                  value={jobForm.minExperienceYears}
                  onChange={(event) => setJobForm((form) => ({ ...form, minExperienceYears: event.target.value }))} />
                <Select label="Séniorité" value={jobForm.seniority} options={SENIORITY_OPTIONS}
                  onChange={(event) => setJobForm((form) => ({ ...form, seniority: event.target.value as Seniority }))} />
                <Field label="Localisation" value={jobForm.location} maxLength={160}
                  onChange={(event) => setJobForm((form) => ({ ...form, location: event.target.value }))} />
                <Select label="Organisation du travail" value={jobForm.workArrangement} options={ARRANGEMENT_OPTIONS}
                  onChange={(event) => setJobForm((form) => ({ ...form, workArrangement: event.target.value as WorkArrangement }))} />
                <Field label="Type de contrat" value={jobForm.contractType} maxLength={80}
                  onChange={(event) => setJobForm((form) => ({ ...form, contractType: event.target.value }))} />
              </div>
              <Button type="submit" variant="secondary" loading={busy === "job"} disabled={busy !== ""}>
                <Plus size={17} /> Ajouter cette offre
              </Button>
            </form>
          </Card>
        </div>
      )}

      {step === 3 && results && (
        <>
          <Card className="jm-section jm-summary">
            <div className="card-heading">
              <div>
                <h2>3. Offres classées pour ton profil</h2>
                <p>
                  {results.results.length} offre{results.results.length > 1 ? "s" : ""} avec un score calculé ·{" "}
                  {results.totalJobsAnalyzed} analysée{results.totalJobsAnalyzed > 1 ? "s" : ""} ·{" "}
                  {results.totalJobsEligible} éligible{results.totalJobsEligible > 1 ? "s" : ""}
                  {results.excludedJobs.length ? ` · ${results.excludedJobs.length} écartée${results.excludedJobs.length > 1 ? "s" : ""}` : ""}
                </p>
                <p className="muted">Score indicatif (0–100), non garanti : il ne remplace pas l’avis d’un recruteur.</p>
              </div>
              <Badge tone="ai"><Sparkles size={12} /> {results.algorithm}</Badge>
            </div>
            {results.excludedJobs.length > 0 && (
              <div className="jm-excluded">
                <h3>Offres écartées par les règles d’éligibilité</h3>
                <ul>
                  {results.excludedJobs.map((item) => (
                    <li key={item.jobId}>
                      <strong>{jobs.find((job) => job.id === item.jobId)?.title ?? item.jobId}</strong>
                      <span>{EXCLUSION_LABELS[item.reason] ?? item.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {results.results.length === 0 ? (
              <EmptyState
                icon={<Target size={24} />}
                title="Aucune offre ne peut être notée"
                description="Les offres sélectionnées ne contiennent pas assez d’informations exploitables. Complète leur description ou choisis d’autres offres."
                action={<Button onClick={() => setStep(2)}>Choisir d’autres offres</Button>}
              />
            ) : (
              <div className="jm-results-layout">
                <ul className="jm-results-list">
                  {results.results.map((match, index) => (
                    <li key={match.jobId}>
                      <ResultCard
                        result={match}
                        job={jobs.find((job) => job.id === match.jobId)}
                        rank={index + 1}
                        selected={selectedResult === match.jobId}
                        onSelect={() => setSelectedResult(match.jobId)}
                      />
                    </li>
                  ))}
                </ul>
                <aside className="jm-detail" aria-live="polite">
                  {selectedMatch ? (
                    <MatchDetail result={selectedMatch} job={selectedJobDetails} />
                  ) : (
                    <p className="muted">Sélectionne une offre pour afficher le détail.</p>
                  )}
                </aside>
              </div>
            )}
          </Card>
        </>
      )}

      <HistoryPanel sessions={history} busyId={busyId} onOpen={(item) => { void openHistory(item) }} onDelete={(item) => { void removeHistory(item) }} />
    </>
  )
}

function MatchDetail({ result, job }: { result: JobMatchResult; job?: JobOffer }) {
  const breakdown: Array<[string, number | null]> = [
    ["Compétences requises", result.scoreBreakdown.requiredSkills],
    ["Compétences appréciées", result.scoreBreakdown.preferredSkills],
    ["Expérience", result.scoreBreakdown.experience],
    ["Séniorité", result.scoreBreakdown.seniority],
    ["Proximité sémantique", result.scoreBreakdown.semanticFit],
  ]
  return (
    <Card>
      <div className="card-heading">
        <div>
          <h2>{result.jobTitle}</h2>
          <p>{result.company || "Entreprise non précisée"} · {arrangementLabel[result.workArrangement]}</p>
        </div>
        <div className="jm-detail-score">
          <strong>{result.compatibilityScore}%</strong>
          <Badge tone={scoreTone(result.compatibilityScore)}>{scoreLabel(result.compatibilityScore)}</Badge>
        </div>
      </div>

      {job && (
        <dl className="jm-job-details">
          <div><dt>Lieu</dt><dd>{job.location || "Non précisé"}</dd></div>
          <div><dt>Contrat</dt><dd>{job.contractType || "Non précisé"}</dd></div>
          <div><dt>Rémunération</dt><dd>{job.salaryRange || "Non communiquée"}</dd></div>
          <div><dt>Expérience demandée</dt><dd>{job.minExperienceYears !== null ? `${job.minExperienceYears} an${job.minExperienceYears > 1 ? "s" : ""}` : "Non précisée"}</dd></div>
        </dl>
      )}
      {job?.isDemo && <p className="muted">Offre fictive de démonstration : aucune candidature réelle n’est possible.</p>}

      <h3>Détail du score</h3>
      <div className="jm-breakdown">
        {breakdown.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value === null ? "Non évalué" : `${Math.round(value * 100)} %`}</strong>
            {value !== null && <Progress value={Math.round(value * 100)} />}
          </div>
        ))}
        <p className="muted">Poids cumulé des critères connus : {Math.round(result.scoreBreakdown.applicableWeightTotal * 100)} %. Les critères inconnus sont exclus du calcul, pas comptés comme des échecs.</p>
      </div>

      {result.gaps.length > 0 && (
        <>
          <h3>Points à renforcer</h3>
          <ul className="jm-plain-list">{result.gaps.map((gap) => <li key={gap}>{gap}</li>)}</ul>
        </>
      )}
      {result.recommendations.length > 0 && (
        <>
          <h3>Recommandations</h3>
          <ul className="jm-plain-list">{result.recommendations.map((item) => <li key={item}>{item}</li>)}</ul>
        </>
      )}
      <h3>Compétences manquantes</h3>
      <p className="muted">
        Requises : {result.missingRequiredSkills.length ? result.missingRequiredSkills.join(", ") : "aucune"} ·{" "}
        Appréciées : {result.missingPreferredSkills.length ? result.missingPreferredSkills.join(", ") : "aucune"}
      </p>
      {job && !job.sourceUrl && <p className="muted">Aucun lien de candidature n’est fourni pour cette offre.</p>}
    </Card>
  )
}
