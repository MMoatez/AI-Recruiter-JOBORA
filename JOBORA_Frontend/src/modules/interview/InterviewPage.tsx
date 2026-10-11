import { useState } from "react"
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Lightbulb,
  MessageSquareText,
  Play,
  Search,
  Settings2,
} from "lucide-react"
import {
  Badge,
  Button,
  Card,
  PageTitle,
  Progress,
  Select,
  Stepper,
  Textarea,
} from "../../components/ui"

export default function InterviewPage() {
  const [stage, setStage] = useState(0)
  const [answer, setAnswer] = useState<number | null>(null)
  return (
    <>
      <PageTitle
        eyebrow="Module 2 · Préparation entretien"
        title="Entraîne-toi sur la vraie offre"
        description="Des questions adaptées au poste et des explications pour progresser à chaque réponse."
      />
      <Stepper
        steps={["Analyser l’offre", "Configurer", "Réviser", "Résultats"]}
        current={stage}
      />
      {stage === 0 && (
        <Card className="focus-card">
          <div className="focus-intro">
            <span className="module-icon">
              <Search size={23} />
            </span>
            <div>
              <h2>Partons de l’offre que tu vises</h2>
              <p>
                Colle son contenu. L’IA détectera les compétences à travailler.
              </p>
            </div>
          </div>
          <Textarea
            label="Description de l’offre"
            rows={11}
            defaultValue="Nous recherchons un développeur Full-Stack Junior maîtrisant React, TypeScript et Node.js. Tu travailleras avec PostgreSQL, Docker et participeras aux code reviews…"
          />
          <div className="detected">
            <span>Compétences détectées</span>
            <div className="chip-row">
              <Badge tone="ai">React</Badge>
              <Badge tone="ai">TypeScript</Badge>
              <Badge tone="ai">Node.js</Badge>
              <Badge tone="neutral">PostgreSQL</Badge>
              <Badge tone="neutral">Docker</Badge>
              <Badge tone="warning">Anglais B2</Badge>
            </div>
          </div>
          <Button variant="ai" onClick={() => setStage(1)}>
            Configurer mon test <ArrowRight size={17} />
          </Button>
        </Card>
      )}
      {stage === 1 && (
        <Card className="focus-card">
          <div className="focus-intro">
            <span className="module-icon">
              <Settings2 size={23} />
            </span>
            <div>
              <h2>Personnalise ta session</h2>
              <p>
                Nous avons prérempli une configuration adaptée à ton niveau.
              </p>
            </div>
          </div>
          <div className="config-grid">
            <Select label="Type de questions">
              <option>Mixte : technique + RH</option>
              <option>QCM</option>
              <option>Questions ouvertes</option>
            </Select>
            <Select label="Nombre de questions">
              <option>10 questions · env. 15 min</option>
              <option>5 questions</option>
              <option>20 questions</option>
            </Select>
            <Select label="Niveau">
              <option>Junior</option>
              <option>Intermédiaire</option>
              <option>Senior</option>
            </Select>
          </div>
          <label className="toggle-row">
            <span>
              <strong>Activer le chronomètre</strong>
              <small>2 minutes maximum par question</small>
            </span>
            <input type="checkbox" />
          </label>
          <Button variant="ai" onClick={() => setStage(2)}>
            <Play size={17} /> Commencer la session
          </Button>
        </Card>
      )}
      {stage === 2 && (
        <Card className="quiz-card">
          <div className="quiz-top">
            <span>Question 3 sur 10</span>
            <Progress value={30} />
            <span>
              <Clock3 size={16} /> 01:24
            </span>
          </div>
          <Badge tone="ai">React · QCM</Badge>
          <h2>
            Pourquoi utilise-t-on une clé unique dans une liste d’éléments React
            ?
          </h2>
          <div className="answers">
            {[
              "Pour appliquer automatiquement du CSS",
              "Pour aider React à identifier les éléments modifiés",
              "Pour chiffrer les données du composant",
              "Pour rendre la liste accessible",
            ].map((x, i) => (
              <button
                onClick={() => setAnswer(i)}
                className={`${answer === i ? "selected" : ""} ${
                  answer !== null && i === 1 ? "correct" : ""
                }`}
                key={x}
              >
                <span>{String.fromCharCode(65 + i)}</span>
                {x}
                {answer !== null && i === 1 && <CheckCircle2 size={19} />}
              </button>
            ))}
          </div>
          {answer !== null && (
            <div className="explanation">
              <Lightbulb size={20} />
              <div>
                <strong>Exactement.</strong>
                <p>
                  La clé permet à React de réconcilier efficacement le DOM
                  virtuel en identifiant chaque élément de façon stable.
                </p>
              </div>
            </div>
          )}
          <div className="quiz-actions">
            <Button variant="ghost">Passer</Button>
            <Button onClick={() => setStage(3)} disabled={answer === null}>
              Question suivante <ArrowRight size={17} />
            </Button>
          </div>
        </Card>
      )}
      {stage === 3 && (
        <div className="results-grid">
          <Card className="result-score">
            <Badge tone="success">Session terminée</Badge>
            <div className="big-score">
              <strong>8,4</strong>
              <span>/ 10</span>
            </div>
            <h2>Très bon travail, Thomas</h2>
            <p>
              Tu maîtrises les fondamentaux. Renforce Docker avant ton
              entretien.
            </p>
            <Button variant="ai">
              <MessageSquareText size={17} /> Lancer un mini entretien blanc
            </Button>
          </Card>
          <Card>
            <h3>Compétences évaluées</h3>
            <div className="skill-bars">
              {[
                ["React", 92],
                ["TypeScript", 84],
                ["Node.js", 78],
                ["PostgreSQL", 75],
                ["Docker", 52],
              ].map(([x, v]) => (
                <div key={String(x)}>
                  <span>
                    <strong>{x}</strong>
                    <small>{v}%</small>
                  </span>
                  <Progress value={Number(v)} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  )
}
