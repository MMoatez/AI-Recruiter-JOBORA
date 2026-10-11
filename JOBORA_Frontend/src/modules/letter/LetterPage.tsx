import { useState } from "react"
import { Check, Clock3, Copy, Download, Plus, RefreshCw } from "lucide-react"
import { AINotice, Button, Card, PageTitle, Select } from "../../components/ui"

export default function LetterPage() {
  const [generating, setGenerating] = useState(false)
  return (
    <>
      <PageTitle
        eyebrow="Module 4 · Lettre de motivation"
        title="Une lettre personnelle, jamais générique"
        description="Chaque argument est relié à ton parcours et aux exigences de l’offre."
        action={
          <>
            <Button variant="secondary">
              <Clock3 size={17} /> Versions
            </Button>
            <Button>
              <Download size={17} /> Exporter
            </Button>
          </>
        }
      />
      <AINotice />
      <div className="letter-layout">
        <Card className="letter-settings">
          <h2>Paramètres</h2>
          <Select label="CV utilisé">
            <option>CV Full-Stack · v3</option>
          </Select>
          <Select label="Offre ciblée">
            <option>Novalys · Full-Stack Junior</option>
          </Select>
          <Select label="Langue">
            <option>Français</option>
            <option>Anglais</option>
          </Select>
          <div className="field">
            <span className="field-label">Ton de la lettre</span>
            <div className="tone-options">
              {["Formel", "Dynamique", "Créatif"].map((x, i) => (
                <button className={i === 1 ? "selected" : ""} key={x}>
                  {x}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="ai"
            className="full"
            loading={generating}
            onClick={() => {
              setGenerating(true)
              setTimeout(() => setGenerating(false), 1200)
            }}
          >
            {generating
              ? "Rédaction de l’introduction…"
              : "Régénérer la lettre"}
          </Button>
          <div className="source-summary">
            <strong>Sources utilisées</strong>
            <span>
              <Check size={14} /> 3 expériences du CV
            </span>
            <span>
              <Check size={14} /> 5 exigences de l’offre
            </span>
            <span>
              <Check size={14} /> Objectif professionnel
            </span>
          </div>
        </Card>
        <Card className="editor-card">
          <div className="editor-toolbar">
            <div>
              <button>
                <b>B</b>
              </button>
              <button>
                <i>I</i>
              </button>
              <button>H2</button>
              <i />
              <button>
                <RefreshCw size={16} />
              </button>
              <button>
                <Copy size={16} />
              </button>
            </div>
            <span>412 mots</span>
          </div>
          <article className="letter-paper">
            <p>Madame, Monsieur,</p>
            <p>
              Actuellement en dernière année d’école d’ingénieur à l’ESIEA, je
              souhaite rejoindre Novalys au poste de Développeur Full-Stack
              Junior. Votre volonté de construire des produits utiles et
              exigeants fait directement écho à mon parcours.
            </p>
            <p>
              Lors de mon alternance chez Greenly, j’ai{" "}
              <mark>
                développé des interfaces React et TypeScript utilisées par plus
                de 5 000 clients
              </mark>
              , tout en participant à la conception d’API REST avec Node.js et
              PostgreSQL. Cette expérience m’a appris à collaborer avec des
              équipes produit et à transformer un besoin utilisateur en solution
              fiable.
            </p>
            <p>
              Curieux et rigoureux, je souhaite aujourd’hui approfondir mes
              compétences en architecture logicielle au sein d’une équipe qui
              valorise les revues de code et le partage de connaissances.
            </p>
            <p>
              Je serais ravi d’échanger avec vous sur ma motivation et la
              manière dont je pourrais contribuer aux projets de Novalys.
            </p>
            <p>
              Bien cordialement,
              <br />
              <strong>Thomas Martin</strong>
            </p>
          </article>
          <div className="paragraph-actions">
            <Button variant="secondary">
              <RefreshCw size={15} /> Régénérer ce paragraphe
            </Button>
            <Button variant="ghost">Raccourcir</Button>
            <Button variant="ghost">Plus formel</Button>
          </div>
        </Card>
      </div>
    </>
  )
}
