import { FormEvent, useEffect, useMemo, useState } from "react"
import { Activity, BarChart3, CheckCircle2, CircleCheck, Clock3, LoaderCircle, MessageSquareText, Sparkles, Target, Upload, XCircle } from "lucide-react"
import { Badge, Button, Card, PageTitle, Select, Textarea } from "../../components/ui"
import { ApiError, authService, entretienRequest } from "../../services/api"

type Offer = { job_title: string; level: "junior" | "intermediaire" | "senior"; skills: string[]; technologies: string[]; soft_skills: string[] }
type Question = { skill: string; type: string; question: string; options: string[]; correct_index?: number | null; source?: string; expected_answer?: string; explanation?: string }
type Session = { id: string; status: string; questions: Question[]; answers: { questionIndex: number; verdict: string; feedback: string; score?: number; selectedIndex?: number | null; userAnswer?: string | null }[]; weakSkills: string[]; error?: string }

const emptyOffer: Offer = { job_title: "", level: "junior", skills: [], technologies: [], soft_skills: [] }
const interviewProgressKey = "jobora.interview.progress"

function progressFor(step: number, session: Session | null) {
  if (step === 4) return 100
  if (step === 3 && session?.questions.length) {
    return Math.round(60 + (session.answers.length / session.questions.length) * 40)
  }
  return [20, 40, 60, 60, 100][step] ?? 0
}

function normalizeSession(value: Session): Session {
  return {
    ...value,
    questions: Array.isArray(value.questions) ? value.questions.map((question) => ({
      ...question,
      question: typeof question.question === "string" ? question.question : "",
      options: Array.isArray(question.options) ? question.options.filter((option): option is string => typeof option === "string") : [],
    })) : [],
    answers: Array.isArray(value.answers) ? value.answers : [],
    weakSkills: Array.isArray(value.weakSkills) ? value.weakSkills : [],
  }
}

export default function InterviewPage() {
  const [step, setStep] = useState(0)
  const [offerText, setOfferText] = useState("")
  const [offer, setOffer] = useState<Offer>(emptyOffer)
  const [cvText, setCvText] = useState("")
  const [type, setType] = useState("mixte")
  const [count, setCount] = useState(5)
  const [level, setLevel] = useState<Offer["level"]>("junior")
  const [session, setSession] = useState<Session | null>(null)
  const [answer, setAnswer] = useState("")
  const [selected, setSelected] = useState<number | null>(null)
  const [answerFeedback, setAnswerFeedback] = useState<{ verdict: string; feedback: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [mock, setMock] = useState<{ role: string; content: string }[]>([])
  const [mockMessage, setMockMessage] = useState("")
  const [aiStatus, setAiStatus] = useState<"checking" | "ok" | "unavailable">("checking")
  const [generationNotice, setGenerationNotice] = useState("")

  const currentIndex = useMemo(() => session?.answers.length || 0, [session])
  const currentQuestion = session?.questions[currentIndex]
  const journeyProgress = progressFor(step, session)
  const correctAnswers = session?.answers.filter((item) => item.verdict === "correct").length || 0
  const totalAnswers = session?.answers.length || 0
  const globalScore = totalAnswers ? Math.round(session!.answers.reduce((sum, item) => sum + (item.score ?? (item.verdict === "correct" ? 100 : 0)), 0) / totalAnswers) : 0

  useEffect(() => {
    sessionStorage.setItem(interviewProgressKey, String(journeyProgress))
    window.dispatchEvent(new CustomEvent("jobora:interview-progress", { detail: journeyProgress }))
  }, [journeyProgress])

  useEffect(() => {
    void entretienRequest<{ status: "ok" | "unavailable" }>("/ai-health")
      .then((result) => setAiStatus(result.status))
      .catch(() => setAiStatus("unavailable"))
  }, [])

  async function analyze() {
    setBusy(true); setError("")
    try { setOffer(await entretienRequest<Offer>("/offre/analyse", { method: "POST", body: JSON.stringify({ offerText }) })); setStep(1) }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { authService.logout(); window.location.replace("/"); return }
      if (cause instanceof ApiError && (cause.status === 400 || cause.status === 422)) setError(cause.message)
      else if (cause instanceof ApiError && cause.status === 503) setError("Le service IA est indisponible. Vérifie qu'Ollama et le service IA sont lancés.")
      else if (cause instanceof ApiError && cause.status === 0) setError("Impossible de joindre le serveur.")
      else setError("Impossible d'analyser l'offre pour le moment.")
    }
    finally { setBusy(false) }
  }

  async function importCv(file?: File) {
    if (!file) return
    setBusy(true); setError("")
    try {
      const form = new FormData(); form.append("file", file)
      const result = await entretienRequest<{ text: string }>("/cv", { method: "POST", body: form })
      setCvText(result.text); setStep(2)
    } catch { setError("Le CV n'a pas pu être lu. Importe un PDF de 5 Mo maximum.") }
    finally { setBusy(false) }
  }

  async function createSession() {
    setBusy(true); setError(""); setGenerationNotice("")
    try {
      const created = await entretienRequest<{ id: string; status: string }>("/sessions", { method: "POST", body: JSON.stringify({ offerText, offer, cvText, type, count, level }) })
      let current = normalizeSession(await entretienRequest<Session>(`/sessions/${created.id}`))
      const startedAt = Date.now()
      while (current.status === "generating") {
        if (Date.now() - startedAt > 30000) setGenerationNotice("La génération est toujours en cours. Le modèle local prépare tes questions, tu peux patienter sans relancer.")
        await new Promise((resolve) => window.setTimeout(resolve, 3000))
        current = normalizeSession(await entretienRequest<Session>(`/sessions/${created.id}`))
      }
      if (current.status === "failed") throw new Error(current.error)
      if (current.questions.length === 0) throw new Error("Aucune question valide n'a été générée. Réessaie avec les mêmes paramètres.")
      setSession(current); setStep(3)
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) { authService.logout(); window.location.replace("/"); return }
      else if (cause instanceof ApiError && cause.status === 0) setError("Impossible de joindre le serveur.")
      else if (cause instanceof ApiError && cause.status === 504) setError("La génération prend plus de temps que prévu. Réduis le nombre de questions ou réessaie.")
      else if (cause instanceof ApiError && cause.status === 503) setError("Le service IA est indisponible. Vérifie qu'Ollama et le service IA sont lancés.")
      else setError(cause instanceof Error && cause.message ? cause.message : "La session n'a pas pu être générée.")
    }
    finally { setBusy(false) }
  }

  async function submitAnswer(event: FormEvent) {
    event.preventDefault()
    if (!session || !currentQuestion || (currentQuestion.type === "qcm" && selected === null)) return
    setBusy(true); setError("")
    try {
      const updated = await entretienRequest<Session>(`/sessions/${session.id}/reponses`, { method: "POST", body: JSON.stringify({ questionIndex: currentIndex, selectedIndex: selected ?? undefined, answer: answer || undefined }) })
      const normalized = normalizeSession(updated)
      const latestAnswer = normalized.answers.find((item) => item.questionIndex === currentIndex)
      setSession(normalized); setAnswer(""); setSelected(null)
      setAnswerFeedback(latestAnswer ? { verdict: latestAnswer.verdict, feedback: latestAnswer.feedback } : null)
    } catch { setError("La correction n'a pas pu être chargée.") }
    finally { setBusy(false) }
  }

  async function sendMock() {
    if (!session || !mockMessage.trim()) return
    const content = mockMessage.trim(); setMockMessage(""); setBusy(true)
    try {
      const result = await entretienRequest<{ message: string; finished: boolean; feedback?: { summary: string } }>(`/sessions/${session.id}/entretien-blanc`, { method: "POST", body: JSON.stringify({ message: content }) })
      setMock((history) => [...history, { role: "user", content }, { role: "assistant", content: result.message }])
    } catch { setError("L'entretien blanc est indisponible pour le moment.") }
    finally { setBusy(false) }
  }

  useEffect(() => { if (session?.status === "ready" && session.answers.length >= session.questions.length) setStep(4) }, [session])

  return (
    <>
      <div className="interview-hero">
        <div>
          <div className="eyebrow">MODULE 2 · PRÉPARATION</div>
          <h1>Prépare ton entretien <Sparkles size={25} aria-hidden="true" /></h1>
          <p>Transforme une offre et ton CV en session de révision personnalisée.</p>
          <div className="interview-ai-line">
            <span>Questions générées par une IA à partir de ton offre et d'une base de connaissances.</span>
            <span className={`interview-health ${aiStatus === "ok" ? "is-ok" : ""}`}><Activity size={14} /> Service IA : {aiStatus === "checking" ? "vérification..." : aiStatus === "ok" ? "connecté" : "indisponible"}</span>
          </div>
        </div>
        <div className="interview-progress-ring" style={{ background: `conic-gradient(var(--primary) ${journeyProgress}%, var(--slate-100) 0)` }} aria-label={`Parcours ${journeyProgress} pour cent`}><strong>{journeyProgress}<span>%</span></strong><small>Parcours</small></div>
      </div>
      {error && <div className="card" style={{ color: "var(--danger)", marginBottom: 20 }} role="alert">{error} <button className="btn btn-ghost" onClick={() => setError("")}>Fermer</button></div>}
      {generationNotice && busy && <div className="card" style={{ marginBottom: 20 }} role="status">{generationNotice}</div>}
      <div className="interview-steps" aria-label="Étapes de préparation">
        {["Offre", "CV", "Configuration", "Session", "Résultats"].map((label, index) => <div className={`interview-step ${index === step ? "is-active" : ""} ${index < step ? "is-done" : ""}`} key={label}><span>{index < step ? <CircleCheck size={17} /> : index + 1}</span><b>{label}</b>{index < 4 && <i />}</div>)}
      </div>
      {step === 0 && <Card title="1. Ton offre d'emploi" subtitle="Colle le texte complet de l'offre pour détecter les compétences attendues."><Textarea label="Offre d'emploi" value={offerText} onChange={(event) => setOfferText(event.target.value)} placeholder="Colle ici l'offre d'emploi..." rows={12} /><Button onClick={analyze} loading={busy} disabled={offerText.trim().length < 20}>Analyser l'offre</Button></Card>}
      {step === 1 && <Card title="2. Ton CV" subtitle={`Poste détecté : ${offer.job_title || "poste ciblé"} · Niveau : ${offer.level}`}><label className="btn btn-secondary" style={{ display: "inline-flex", gap: 8, cursor: "pointer" }}><Upload size={17} /> Importer un PDF<input hidden type="file" accept="application/pdf" onChange={(event) => void importCv(event.target.files?.[0])} /></label><p className="muted">Le fichier est envoyé uniquement au backend pour extraire son texte.</p><Button variant="ghost" onClick={() => setStep(2)}>Continuer sans CV</Button></Card>}
      {step === 2 && <Card title="3. Configure ta session" subtitle="Choisis le type de questions ; la réponse sera toujours donnée sous forme de QCM."><div className="form-grid"><Select label="Type de questions" value={type} onChange={(event) => setType(event.target.value)} options={[["mixte", "Mixte"], ["ouverte", "Questions ouvertes"], ["technique", "Techniques"], ["rh", "RH"]]} /><Select label="Niveau" value={level} onChange={(event) => setLevel(event.target.value as Offer["level"])} options={[["junior", "Junior"], ["intermediaire", "Intermédiaire"], ["senior", "Senior"]]} /></div><label>Nombre de questions<input className="input" type="number" min={1} max={20} value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><div style={{ marginTop: 20 }}><Button onClick={() => void createSession()} loading={busy}>Générer ma session</Button></div></Card>}
      {step === 3 && session && currentQuestion && <Card className="interview-question-card"><div className="question-card-top"><span className="question-counter">QUESTION {String(currentIndex + 1).padStart(2, "0")} / {String(session.questions.length).padStart(2, "0")}</span><Badge tone="ai">{currentQuestion.skill} · QCM</Badge></div><form onSubmit={submitAnswer}><h2>{currentQuestion.question || "Question indisponible. Relance une nouvelle session."}</h2><div className="question-options">{currentQuestion.options.length > 0 ? currentQuestion.options.map((option, index) => <label key={`${index}-${option}`} className={`question-option ${selected === index ? "is-selected" : ""}`}><input type="radio" name="answer" checked={selected === index} onChange={() => setSelected(index)} /><span className="option-letter">{String.fromCharCode(65 + index)}</span><span>{option}</span></label>) : <p className="muted">Aucun choix n'a été généré pour cette question. Relance une session.</p>}</div><Button type="submit" loading={busy} disabled={selected === null || currentQuestion.options.length === 0}>Valider ma réponse</Button></form>{answerFeedback && <div className={`answer-feedback ${answerFeedback.verdict === "correct" ? "is-correct" : "is-wrong"}`}><strong>{answerFeedback.verdict === "correct" ? "Réponse correcte" : "Réponse à revoir"}</strong><span>{answerFeedback.feedback}</span></div>}</Card>}
      {step === 3 && session && !currentQuestion && <Card title="Session terminée"><CheckCircle2 color="var(--success)" /><Button onClick={() => setStep(4)}>Voir mes résultats</Button></Card>}
      {step === 4 && session && <div className="interview-results">
        <div className="results-title"><div><span className="eyebrow">SESSION TERMINÉE</span><h2>Bravo, tu as terminé ta session !</h2><p>Voici une synthèse de tes réponses et des points à travailler.</p></div><Badge tone="success"><CheckCircle2 size={14} /> Résultats finalisés</Badge></div>
        <div className="results-grid">
          <Card className="result-score-card"><div className="result-card-heading"><span>Score global</span><Target size={17} /></div><div className="result-score-ring" style={{ background: `conic-gradient(var(--primary) ${globalScore}%, var(--slate-100) 0)` }}><strong>{globalScore}<small>%</small></strong><span>Score global</span></div><div className="result-stat-row"><span><Clock3 size={15} /> Questions traitées</span><b>{totalAnswers} / {session.questions.length}</b></div></Card>
          <Card className="result-skills-card"><div className="result-card-heading"><span>Analyse des compétences</span><BarChart3 size={17} /></div>{session.weakSkills.length > 0 ? <div className="skill-analysis">{session.weakSkills.slice(0, 4).map((skill, index) => <div className="skill-analysis-row" key={skill}><span>{skill}</span><div><i style={{ width: `${Math.max(28, 78 - index * 13)}%` }} /></div><b>{Math.max(28, 78 - index * 13)}%</b></div>)}</div> : <div className="result-empty"><CheckCircle2 size={22} /><span>Aucune compétence particulière à renforcer.</span></div>}<p className="result-helper">Les compétences sont calculées à partir de tes réponses.</p></Card>
          <Card className="result-feedback-card"><div className="result-card-heading"><span>Feedback par question</span><Badge tone="ai">{correctAnswers} correctes</Badge></div><div className="feedback-list">{session.answers.map((item) => { const question = session.questions[item.questionIndex]; const correct = item.verdict === "correct"; const selectedAnswer = item.selectedIndex !== null && item.selectedIndex !== undefined ? question?.options[item.selectedIndex] : item.userAnswer; const correctAnswer = question?.correct_index !== null && question?.correct_index !== undefined ? question.options[question.correct_index] : question?.expected_answer; return <details className={`feedback-item ${correct ? "is-correct" : "is-wrong"}`} key={item.questionIndex}><summary><span className="feedback-icon">{correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}</span><b>Question {item.questionIndex + 1}</b><Badge tone={correct ? "success" : "warning"}>{correct ? "Correcte" : "À revoir"}</Badge><span className="feedback-chevron">⌄</span></summary><div className="feedback-content">{question?.question && <strong>{question.question}</strong>}{!correct && <div className="answer-comparison"><p><b>Ta réponse :</b> {selectedAnswer || "Aucune réponse sélectionnée"}</p><p><b>Bonne réponse :</b> {correctAnswer || "Non disponible"}</p></div>}<p>{item.feedback}</p></div></details> })}</div></Card>
        </div>
        <Card className="mock-card"><div className="result-card-heading"><span><MessageSquareText size={17} /> Mini entretien blanc</span><Badge tone="neutral">Entraînement</Badge></div><p className="muted">Réponds au recruteur et utilise son feedback pour améliorer ta réponse.</p><div className="chat-box">{mock.map((message, index) => <p key={index}><strong>{message.role === "user" ? "Toi" : "Recruteur"} :</strong> {message.content}</p>)}</div><div className="mock-input-row"><input className="input" value={mockMessage} onChange={(event) => setMockMessage(event.target.value)} placeholder="Réponds au recruteur..." /><Button onClick={() => void sendMock()} loading={busy}>Envoyer</Button></div></Card>
      </div>}
    </>
  )
}
