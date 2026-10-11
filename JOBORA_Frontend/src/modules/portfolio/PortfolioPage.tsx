import { useState } from "react"
import {
  ArrowRight,
  Circle,
  ExternalLink,
  GripVertical,
  Monitor,
  Palette,
  RefreshCw,
  Rocket,
  Save,
  Smartphone,
  Tablet,
} from "lucide-react"
import { Badge, Button, Card, PageTitle } from "../../components/ui"

export default function PortfolioPage() {
  const [device, setDevice] = useState("desktop")
  const templates = [
    "Développeur",
    "Étudiant",
    "Minimal",
    "Moderne",
    "Professionnel",
  ]
  return (
    <>
      <PageTitle
        eyebrow="Module 6 · Portfolio"
        title="Ton travail mérite d’être vu"
        description="Transforme ton CV en portfolio professionnel, personnalisable et prêt à publier."
        action={
          <>
            <Button variant="secondary">
              <Save size={17} /> Enregistrer
            </Button>
            <Button variant="ai">
              <Rocket size={17} /> Publier
            </Button>
          </>
        }
      />
      <div className="portfolio-toolbar">
        <div className="template-picker">
          {templates.map((x, i) => (
            <button className={i === 0 ? "active" : ""} key={x}>
              <span className={`template-thumb t${i}`} />
              {x}
            </button>
          ))}
        </div>
      </div>
      <div className="portfolio-editor">
        <Card className="portfolio-sidebar">
          <div className="sync-card">
            <RefreshCw size={18} />
            <span>
              <strong>Synchronisé avec ton CV</strong>
              <small>Dernière mise à jour il y a 2 h</small>
            </span>
            <button>Actualiser</button>
          </div>
          <h3>Sections</h3>
          <div className="section-list">
            {[
              "Accueil",
              "À propos",
              "Compétences",
              "Expériences",
              "Projets",
              "Certifications",
              "Contact",
            ].map((x, i) => (
              <button className={i === 0 ? "active" : ""} key={x}>
                <GripVertical size={16} />
                <span>{x}</span>
                <EyeMini />
              </button>
            ))}
          </div>
          <h3>Apparence</h3>
          <div className="color-row">
            <button className="color c1" />
            <button className="color c2" />
            <button className="color c3" />
            <button className="color c4" />
            <button className="color c5" />
          </div>
          <Button variant="secondary" className="full">
            <Palette size={17} /> Personnaliser le thème
          </Button>
        </Card>
        <div className="portfolio-preview">
          <div className="device-toolbar">
            <span>Aperçu</span>
            <div>
              <button
                className={device === "desktop" ? "active" : ""}
                onClick={() => setDevice("desktop")}
              >
                <Monitor size={17} />
              </button>
              <button
                className={device === "tablet" ? "active" : ""}
                onClick={() => setDevice("tablet")}
              >
                <Tablet size={17} />
              </button>
              <button
                className={device === "mobile" ? "active" : ""}
                onClick={() => setDevice("mobile")}
              >
                <Smartphone size={17} />
              </button>
            </div>
            <button>
              <ExternalLink size={16} /> Ouvrir
            </button>
          </div>
          <div className={`website ${device}`}>
            <nav>
              <strong>TM.</strong>
              <div>
                <span>À propos</span>
                <span>Expériences</span>
                <span>Projets</span>
                <b>Me contacter</b>
              </div>
            </nav>
            <section>
              <Badge tone="teal">Disponible pour une opportunité</Badge>
              <h2>
                Je crée des expériences web <em>utiles et soignées.</em>
              </h2>
              <p>
                Développeur Full-Stack Junior basé à Paris. J’aime transformer
                des problèmes complexes en produits simples.
              </p>
              <div>
                <Button>
                  Voir mes projets <ArrowRight size={16} />
                </Button>
                <Button variant="ghost">Télécharger mon CV</Button>
              </div>
            </section>
            <footer>
              <span>React</span>
              <span>TypeScript</span>
              <span>Node.js</span>
              <span>PostgreSQL</span>
            </footer>
          </div>
        </div>
      </div>
    </>
  )
}

function EyeMini() {
  return <Circle size={10} />
}
