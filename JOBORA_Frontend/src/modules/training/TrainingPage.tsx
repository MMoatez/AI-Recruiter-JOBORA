import { useState } from "react"
import {
  BookOpen,
  Check,
  Clock3,
  ExternalLink,
  FilePenLine,
  Target,
  TrendingUp,
} from "lucide-react"
import { Badge, Button, Card, PageTitle, Progress } from "../../components/ui"

export default function TrainingPage() {
  const [done, setDone] = useState([false, false, false])
  return (
    <>
      <PageTitle
        eyebrow="Module 5 · Formations"
        title="Ta roadmap pour progresser"
        description="Des ressources ciblées sur tes écarts, avec des projets concrets à valoriser."
        action={
          <Button variant="secondary">
            <Clock3 size={17} /> 5 h disponibles / semaine
          </Button>
        }
      />
      <div className="training-summary">
        <Card>
          <span className="module-icon warning">
            <Target size={21} />
          </span>
          <div>
            <small>Écart prioritaire</small>
            <strong>Docker & conteneurisation</strong>
            <span>Requis dans 4 offres sur 5</span>
          </div>
        </Card>
        <Card>
          <span className="module-icon">
            <Clock3 size={21} />
          </span>
          <div>
            <small>Temps estimé</small>
            <strong>4 semaines</strong>
            <span>À ton rythme actuel</span>
          </div>
        </Card>
        <Card>
          <span className="module-icon teal">
            <TrendingUp size={21} />
          </span>
          <div>
            <small>Compatibilité projetée</small>
            <strong>82 % → 91 %</strong>
            <span>Après cette roadmap</span>
          </div>
        </Card>
      </div>
      <Card className="roadmap">
        <div className="card-heading">
          <div>
            <Badge tone="ai">Roadmap personnalisée</Badge>
            <h2>Maîtriser Docker pour un poste junior</h2>
            <p>3 étapes · 8 heures au total · Niveau débutant</p>
          </div>
          <Progress value={33} label="33 %" />
        </div>
        <div className="timeline">
          {[
            [
              "Comprendre les fondamentaux",
              "2 h · Cours + documentation",
              "Introduction à Docker, images, conteneurs et volumes.",
              [
                "Docker — Prise en main officielle",
                "OpenClassrooms — Virtualisez vos applications",
              ],
            ],
            [
              "Pratiquer sur un mini-projet",
              "4 h · Projet guidé",
              "Conteneurise une API Node.js avec une base PostgreSQL.",
              ["Brief du projet et starter kit", "Checklist de validation"],
            ],
            [
              "Valoriser et certifier",
              "2 h · Finalisation",
              "Documente ton projet et ajoute-le à ton CV.",
              ["Modèle de README", "Quiz de validation des acquis"],
            ],
          ].map((item, i) => (
            <div
              className={`timeline-item ${done[i] ? "complete" : ""}`}
              key={String(item[0])}
            >
              <button
                className="timeline-check"
                onClick={() => setDone(done.map((x, j) => (j === i ? !x : x)))}
              >
                {done[i] ? <Check size={17} /> : i + 1}
              </button>
              <div>
                <div className="timeline-title">
                  <div>
                    <h3>{item[0]}</h3>
                    <span>{item[1]}</span>
                  </div>
                  {done[i] && <Badge tone="success">Terminé</Badge>}
                </div>
                <p>{item[2]}</p>
                <div className="resource-list">
                  {(item[3] as string[]).map((x) => (
                    <button key={x}>
                      <span>
                        <BookOpen size={17} />
                      </span>
                      <strong>{x}</strong>
                      <ExternalLink size={15} />
                    </button>
                  ))}
                </div>
                {i === 2 && (
                  <div className="cv-add">
                    <FilePenLine size={18} />
                    <span>
                      <strong>Prêt à être ajouté au CV</strong>
                      <small>
                        Une fois terminé, nous t’aiderons à le formuler.
                      </small>
                    </span>
                    <Button variant="secondary">Prévisualiser</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
