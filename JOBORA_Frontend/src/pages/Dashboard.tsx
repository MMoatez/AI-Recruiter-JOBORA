import { useEffect, useMemo, useState } from "react"
import {
  ArrowRight, BookOpen, BriefcaseBusiness, ChevronRight, FileCheck2,
  FilePenLine, FileText, GraduationCap, MoreHorizontal, Plus, Sparkles, Webhook,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { AINotice, Badge, Button, Card, PageTitle, Progress } from "../components/ui"
import { ApiError, protectedRequest, readSession } from "../services/api"

type CvSummary = {
  id: string
  title?: string
  targetJob?: string
  status?: "draft" | "generated"
  professionalSummary?: string
  experiences?: unknown[]
  projects?: unknown[]
  technicalSkills?: string[]
  atsValidation?: { score?: number } | null
  updatedAt?: string
}

type InterviewSummary = {
  id: string
  status: string
  offer?: { job_title?: string; level?: string; skills?: string[] }
  config?: { count?: number; level?: string; type?: string }
  questions?: unknown[]
  answers?: Array<{ score?: number; verdict?: string }>
  updatedAt?: string
}

function formatDate(value?: string) {
  if (!value) return "Pas encore d'activité"
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value))
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [cv, setCv] = useState<CvSummary | null>(null)
  const [interviews, setInterviews] = useState<InterviewSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const user = readSession()?.user

  useEffect(() => {
    let active = true
    Promise.all([
      protectedRequest<CvSummary[]>("/cvs"),
      protectedRequest<InterviewSummary[]>("/entretien/sessions"),
    ]).then(([cvs, sessions]) => {
      if (!active) return
      setCv(cvs[0] || null)
      setInterviews(sessions)
    }).catch((cause) => {
      if (active && !(cause instanceof ApiError && cause.status === 401)) setError("Les données du tableau de bord sont momentanément indisponibles.")
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [])

  const latestInterview = interviews[0]
  const profileProgress = useMemo(() => {
    if (!cv) return 0
    const sections = [cv.professionalSummary, cv.experiences?.length, cv.projects?.length, cv.technicalSkills?.length]
    return Math.round(sections.filter(Boolean).length / sections.length * 100)
  }, [cv])
  const interviewProgress = latestInterview
    ? Math.min(100, Math.round(((latestInterview.answers?.length || 0) / Math.max(latestInterview.questions?.length || latestInterview.config?.count || 1, 1)) * 100))
    : 0
  const globalScore = latestInterview?.answers?.length
    ? Math.round(latestInterview.answers.reduce((sum, answer) => sum + (answer.score ?? (answer.verdict === "correct" ? 100 : 0)), 0) / latestInterview.answers.length)
    : null
  const completedModules = [cv?.status === "generated", interviewProgress === 100, false, false, false, false].filter(Boolean).length
  const activity = [
    cv && { icon: FileText, title: cv.title || "Mon CV", date: `Mis à jour le ${formatDate(cv.updatedAt)}`, to: "/app/cv" },
    latestInterview && { icon: BookOpen, title: latestInterview.offer?.job_title || "Préparation entretien", date: `Session du ${formatDate(latestInterview.updatedAt)}`, to: "/app/entretien" },
  ].filter(Boolean) as Array<{ icon: typeof FileText; title: string; date: string; to: string }>

  const modules = [
    { title: "CV intelligent", text: cv ? "Ton CV enregistré et son état de complétion." : "Crée ton premier CV personnalisé.", icon: FilePenLine, to: "/app/cv", status: cv ? (cv.status === "generated" ? "Terminé" : "En cours") : "À commencer", tone: cv?.status === "generated" ? "success" as const : cv ? "warning" as const : "neutral" as const, progress: profileProgress },
    { title: "Préparation entretien", text: latestInterview?.offer?.job_title ? `Session pour ${latestInterview.offer.job_title}.` : "Entraîne-toi depuis une offre réelle.", icon: BookOpen, to: "/app/entretien", status: latestInterview ? (interviewProgress === 100 ? "Terminé" : "En cours") : "À commencer", tone: latestInterview ? "warning" as const : "neutral" as const, progress: interviewProgress },
    { title: "Matching CV / offre", text: "Analyse une compatibilité depuis le module Matching.", icon: FileCheck2, to: "/app/matching", status: "À commencer", tone: "neutral" as const, progress: 0 },
    { title: "Lettre de motivation", text: "Prépare une lettre ciblée pour une candidature.", icon: BriefcaseBusiness, to: "/app/lettre", status: "À commencer", tone: "neutral" as const, progress: 0 },
    { title: "Formations", text: "Développe les compétences identifiées.", icon: GraduationCap, to: "/app/formations", status: "À commencer", tone: "neutral" as const, progress: 0 },
    { title: "Portfolio", text: "Construis un portfolio à partir de ton parcours.", icon: Webhook, to: "/app/portfolio", status: "À commencer", tone: "neutral" as const, progress: 0 },
  ]

  return (
    <>
      <PageTitle
        eyebrow={new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
        title={`Bonjour ${user?.name || "et bienvenue"}, prêt à avancer ?`}
        description={cv ? `Ton profil est complété à ${profileProgress} %. Continue à renforcer ta candidature.` : "Commence par créer ton CV pour construire ton profil candidat."}
        action={<Button variant="secondary" onClick={() => navigate("/app/entretien")}><Plus size={17} /> Ajouter une offre</Button>}
      />
      {error && <div className="card dashboard-error" role="alert">{error}</div>}
      <Card className="hero-action">
        <div className="hero-action-copy">
          <Badge tone="ai"><Sparkles size={13} /> Recommandation personnalisée</Badge>
          <h2>{cv ? (cv.status === "generated" ? "Ton CV est prêt pour tes candidatures" : "Continue à compléter ton CV") : "Crée ton CV pour commencer"}</h2>
          <p>{cv ? `Ton profil est actuellement complété à ${profileProgress} %. Ajoute les informations manquantes pour améliorer tes résultats.` : "Ajoute tes expériences, tes compétences et tes projets pour obtenir des recommandations adaptées."}</p>
          <Button variant="ai" onClick={() => navigate(cv ? "/app/cv" : "/app/cv")}>{cv ? "Continuer mon CV" : "Créer mon CV"} <ArrowRight size={17} /></Button>
        </div>
        <div className="profile-ring">
          <div className="ring" style={{ background: `conic-gradient(var(--primary) ${profileProgress}%, var(--slate-100) 0)` }}><strong>{profileProgress}%</strong><span>Profil</span></div>
          <p><strong>{profileProgress >= 80 ? "Profil bien avancé" : "Encore un peu d'effort"}</strong><span>{cv ? "Complète les sections restantes" : "Aucune donnée enregistrée"}</span></p>
        </div>
      </Card>
      <div className="section-heading">
        <div><h2>Tes outils de candidature</h2><p>Progression calculée à partir de tes données.</p></div>
        <span>{completedModules} sur 6 complétés</span>
      </div>
      <div className="module-grid">
        {modules.map(({ icon: Icon, ...item }) => <Card className="module-card" key={item.title}><div className="module-top"><span className="module-icon"><Icon size={22} /></span><Badge tone={item.tone}>{item.status}</Badge></div><h3>{item.title}</h3><p>{item.text}</p><Progress value={item.progress} /><button onClick={() => navigate(item.to)}>Ouvrir l’outil <ArrowRight size={16} /></button></Card>)}
      </div>
      <div className="dashboard-lower">
        <Card className="active-offer">
          <div className="card-heading"><div><span className="company-logo">{latestInterview?.offer?.job_title?.slice(0, 1).toUpperCase() || "?"}</span><div><Badge tone="teal">{latestInterview ? "Dernière offre" : "Aucune offre"}</Badge><h3>{latestInterview?.offer?.job_title || "Ajoute une offre d'emploi"}</h3><p>{latestInterview ? `${latestInterview.offer?.level || "Niveau non précisé"} · ${latestInterview.offer?.skills?.length || 0} compétences détectées` : "Lance une préparation pour afficher ton offre active."}</p></div></div><button className="icon-btn" onClick={() => navigate("/app/entretien")}><MoreHorizontal size={19} /></button></div>
          <div className="offer-score">{globalScore !== null ? <><div className="mini-ring"><strong>{globalScore}</strong><span>%</span></div><div><strong>Score de ta dernière session</strong><p>{latestInterview?.answers?.length || 0} réponse(s) évaluée(s).</p><button onClick={() => navigate("/app/entretien")}>Voir les résultats <ChevronRight size={15} /></button></div></> : <div><strong>Aucune session évaluée</strong><p>Prépare ton premier entretien pour obtenir un score réel.</p><button onClick={() => navigate("/app/entretien")}>Commencer <ChevronRight size={15} /></button></div>}</div>
          <AINotice />
        </Card>
        <Card><div className="card-heading"><div><h3>Activité récente</h3><p>{loading ? "Chargement..." : "Tes dernières données enregistrées"}</p></div><button onClick={() => navigate("/app/cv")}>Tout voir</button></div><div className="activity-list">{activity.length ? activity.map(({ icon: Icon, title, date, to }) => <div key={`${title}-${date}`} onClick={() => navigate(to)}><span><Icon size={18} /></span><p><strong>{title}</strong><small>{date}</small></p><ChevronRight size={16} /></div>) : <p className="muted">Aucune activité récente.</p>}</div></Card>
      </div>
    </>
  )
}
