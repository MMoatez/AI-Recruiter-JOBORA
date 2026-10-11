import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  FileCheck2,
  FilePenLine,
  FileText,
  GraduationCap,
  MoreHorizontal,
  Plus,
  Sparkles,
  Webhook,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  AINotice,
  Badge,
  Button,
  Card,
  PageTitle,
  Progress,
} from "../components/ui"

const modules = [
  {
    title: "CV intelligent",
    text: "Crée un CV ciblé et convaincant.",
    icon: FilePenLine,
    to: "/app/cv",
    status: "En cours",
    tone: "warning" as const,
    progress: 65,
  },
  {
    title: "Préparation entretien",
    text: "Entraîne-toi depuis une offre réelle.",
    icon: BookOpen,
    to: "/app/entretien",
    status: "À commencer",
    tone: "neutral" as const,
    progress: 0,
  },
  {
    title: "Matching CV / offre",
    text: "Comprends précisément ta compatibilité.",
    icon: FileCheck2,
    to: "/app/matching",
    status: "Terminé",
    tone: "success" as const,
    progress: 100,
  },
  {
    title: "Lettre de motivation",
    text: "Génère une lettre personnelle et ciblée.",
    icon: BriefcaseBusiness,
    to: "/app/lettre",
    status: "À commencer",
    tone: "neutral" as const,
    progress: 0,
  },
  {
    title: "Formations",
    text: "Comble tes écarts avec une roadmap.",
    icon: GraduationCap,
    to: "/app/formations",
    status: "3 suggestions",
    tone: "teal" as const,
    progress: 20,
  },
  {
    title: "Portfolio",
    text: "Transforme ton CV en site professionnel.",
    icon: Webhook,
    to: "/app/portfolio",
    status: "À commencer",
    tone: "neutral" as const,
    progress: 0,
  },
]

export default function Dashboard() {
  const navigate = useNavigate()
  return (
    <>
      <PageTitle
        eyebrow="Mardi 18 juin"
        title="Bonjour Thomas, prêt à avancer ?"
        description="Ton profil prend forme. Une action simple aujourd’hui peut faire la différence."
        action={
          <Button variant="secondary">
            <Plus size={17} /> Ajouter une offre
          </Button>
        }
      />
      <Card className="hero-action">
        <div className="hero-action-copy">
          <Badge tone="ai">
            <Sparkles size={13} /> Recommandation du jour
          </Badge>
          <h2>Finalise ton CV pour l’offre de Novalys</h2>
          <p>
            Il te reste 3 expériences à reformuler. Un CV complet améliorera la
            précision de ton matching.
          </p>
          <Button variant="ai" onClick={() => navigate("/app/cv")}>
            Continuer mon CV <ArrowRight size={17} />
          </Button>
        </div>
        <div className="profile-ring">
          <div className="ring">
            <strong>72%</strong>
            <span>Profil</span>
          </div>
          <p>
            <strong>Encore un petit effort</strong>
            <span>+8 % en ajoutant tes projets</span>
          </p>
        </div>
      </Card>
      <div className="section-heading">
        <div>
          <h2>Tes outils de candidature</h2>
          <p>Tout ce qu’il te faut, au même endroit.</p>
        </div>
        <span>2 sur 6 complétés</span>
      </div>
      <div className="module-grid">
        {modules.map(({ icon: Icon, ...item }) => (
          <Card className="module-card" key={item.title}>
            <div className="module-top">
              <span className="module-icon">
                <Icon size={22} />
              </span>
              <Badge tone={item.tone}>{item.status}</Badge>
            </div>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
            <Progress value={item.progress} />
            <button onClick={() => navigate(item.to)}>
              Ouvrir l’outil <ArrowRight size={16} />
            </button>
          </Card>
        ))}
      </div>
      <div className="dashboard-lower">
        <Card className="active-offer">
          <div className="card-heading">
            <div>
              <span className="company-logo">N</span>
              <div>
                <Badge tone="teal">Offre active</Badge>
                <h3>Développeur Full-Stack Junior</h3>
                <p>Novalys · Paris · Hybride</p>
              </div>
            </div>
            <button className="icon-btn">
              <MoreHorizontal size={19} />
            </button>
          </div>
          <div className="offer-score">
            <div className="mini-ring">
              <strong>82</strong>
              <span>%</span>
            </div>
            <div>
              <strong>Très bonne compatibilité</strong>
              <p>12 critères correspondent, 3 sont à renforcer.</p>
              <button onClick={() => navigate("/app/matching")}>
                Voir l’analyse détaillée <ChevronRight size={15} />
              </button>
            </div>
          </div>
          <AINotice />
        </Card>
        <Card>
          <div className="card-heading">
            <div>
              <div>
                <h3>Activité récente</h3>
                <p>Tes derniers documents</p>
              </div>
            </div>
            <button>Tout voir</button>
          </div>
          <div className="activity-list">
            {[
              [FileText, "CV Full-Stack v3", "Modifié il y a 2 h"],
              [BriefcaseBusiness, "Lettre · Novalys", "Générée hier"],
              [FileCheck2, "Analyse de matching", "18 juin 2025"],
            ].map(([Icon, title, date]) => (
              <div key={String(title)}>
                <span>
                  <Icon size={18} />
                </span>
                <p>
                  <strong>{String(title)}</strong>
                  <small>{String(date)}</small>
                </p>
                <ChevronRight size={16} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}
