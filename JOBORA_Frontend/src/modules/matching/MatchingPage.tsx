import { useState } from "react"
import {
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronDown,
  Circle,
  GraduationCap,
  Lightbulb,
  PenLine,
  Plus,
  RefreshCw,
  Sparkles,
  UploadCloud,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  AINotice,
  Badge,
  Button,
  Card,
  PageTitle,
  Progress,
  Textarea,
} from "../../components/ui"

export default function MatchingPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState(true)
  return (
    <>
      <PageTitle
        eyebrow="Module 3 · Matching CV / offre"
        title="Comprends vraiment ta compatibilité"
        description="Une analyse transparente des exigences détectées — jamais une prédiction de recrutement."
        action={
          result ? (
            <Button variant="secondary" onClick={() => setResult(false)}>
              <RefreshCw size={17} /> Nouvelle analyse
            </Button>
          ) : undefined
        }
      />
      {!result ? (
        <div className="match-input-grid">
          <Card className="dropzone">
            <UploadCloud size={30} />
            <h2>Dépose ton CV</h2>
            <p>PDF uniquement · 10 Mo maximum</p>
            <Button variant="secondary">Choisir un fichier</Button>
            <span>CV_Thomas_Martin_2025.pdf</span>
          </Card>
          <Card>
            <Textarea
              label="Colle l’offre d’emploi"
              rows={12}
              placeholder="Copie ici la description complète de l’offre…"
            />
            <Button
              variant="ai"
              className="full"
              onClick={() => setResult(true)}
            >
              Analyser la compatibilité <Sparkles size={17} />
            </Button>
          </Card>
        </div>
      ) : (
        <>
          <AINotice />
          <div className="matching-hero">
            <Card className="score-card">
              <div className="match-ring">
                <div>
                  <strong>82</strong>
                  <span>%</span>
                </div>
              </div>
              <div>
                <Badge tone="success">Très bonne compatibilité</Badge>
                <h2>82 % de compatibilité avec les exigences détectées</h2>
                <p>
                  Ton profil couvre 12 des 15 critères identifiés dans l’offre
                  Novalys.
                </p>
              </div>
            </Card>
            <Card className="score-explainer">
              <div className="card-heading">
                <div>
                  <h3>Comment ce score est calculé</h3>
                  <p>Chaque catégorie est pondérée selon l’offre.</p>
                </div>
                <Badge tone="ai">
                  <Sparkles size={12} /> Explicable
                </Badge>
              </div>
              <div className="weighted-bars">
                {[
                  ["Compétences obligatoires", "50 %", 86],
                  ["Expérience", "20 %", 75],
                  ["Formation", "10 %", 100],
                  ["Langues", "10 %", 70],
                  ["Compétences bonus", "10 %", 65],
                ].map(([x, w, v]) => (
                  <div key={String(x)}>
                    <div>
                      <span>{x}</span>
                      <small>Poids {w}</small>
                      <strong>{v}%</strong>
                    </div>
                    <Progress value={Number(v)} />
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="score-disclaimer">
            <Lightbulb size={19} />
            <p>
              <strong>
                Ce score ne représente pas tes chances d’être accepté.
              </strong>{" "}
              Il mesure uniquement la compatibilité de ton CV avec les exigences
              que nous avons détectées dans cette offre.
            </p>
          </div>
          <Card className="criteria-card">
            <div className="card-heading">
              <div>
                <h2>Détail des critères</h2>
                <p>15 exigences détectées dans l’offre</p>
              </div>
              <div className="legend">
                <Badge tone="success">12 correspondent</Badge>
                <Badge tone="warning">2 partiels</Badge>
                <Badge tone="danger">1 manquant</Badge>
              </div>
            </div>
            <div className="criteria-table">
              {[
                [
                  "React & TypeScript",
                  "Compétence obligatoire",
                  "Correspond",
                  "Mentionnés dans 2 expériences récentes avec des réalisations mesurées.",
                  "success",
                ],
                [
                  "Node.js & API REST",
                  "Compétence obligatoire",
                  "Correspond",
                  "12 mois d’utilisation chez Greenly, contexte directement pertinent.",
                  "success",
                ],
                [
                  "Docker",
                  "Compétence obligatoire",
                  "Partiel",
                  "Docker apparaît dans tes compétences, mais aucune expérience ne l’illustre.",
                  "warning",
                ],
                [
                  "2 ans d’expérience",
                  "Expérience",
                  "Partiel",
                  "18 mois d’expérience cumulée détectés. L’écart reste limité.",
                  "warning",
                ],
                [
                  "Anglais niveau B2",
                  "Langues",
                  "Manquant",
                  "Ton niveau d’anglais n’est pas précisé dans le CV.",
                  "danger",
                ],
              ].map(([name, type, status, why, tone]) => (
                <details key={name}>
                  <summary>
                    <span className="criterion-icon">
                      {tone === "success" ? (
                        <Check size={16} />
                      ) : tone === "warning" ? (
                        <Circle size={12} />
                      ) : (
                        <Plus size={15} />
                      )}
                    </span>
                    <span>
                      <strong>{name}</strong>
                      <small>{type}</small>
                    </span>
                    <Badge tone={tone as "success" | "warning" | "danger"}>
                      {status}
                    </Badge>
                    <ChevronDown size={17} />
                  </summary>
                  <div className="criterion-detail">
                    <Sparkles size={16} />
                    <p>
                      <strong>Pourquoi ce statut ?</strong>
                      {why}
                    </p>
                    <Button variant="ghost">
                      <PenLine size={15} /> Améliorer mon CV
                    </Button>
                  </div>
                </details>
              ))}
            </div>
          </Card>
          <div className="next-actions">
            <h2>Transforme cette analyse en actions</h2>
            <div>
              {[
                [
                  BriefcaseBusiness,
                  "Générer ma lettre",
                  "Une lettre ciblée sur les points forts",
                  "/app/lettre",
                ],
                [
                  GraduationCap,
                  "Voir mes formations",
                  "Une roadmap pour combler les écarts",
                  "/app/formations",
                ],
                [
                  BookOpen,
                  "Réviser l’entretien",
                  "Des questions adaptées à cette offre",
                  "/app/entretien",
                ],
              ].map(([Icon, title, text, to]) => (
                <Button
                  key={String(title)}
                  variant="secondary"
                  onClick={() => navigate(String(to))}
                >
                  <Icon size={20} />
                  <span>
                    <strong>{String(title)}</strong>
                    <small>{String(text)}</small>
                  </span>
                  <ArrowRight size={17} />
                </Button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  )
}
