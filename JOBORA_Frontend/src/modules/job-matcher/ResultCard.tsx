import { MapPin, Sparkles } from "lucide-react"
import { Badge, Button, Progress } from "../../components/ui"
import type { JobMatchResult, JobOffer, WorkArrangement } from "./types"
import { scoreLabel, scoreTone } from "./jobMatcherService"

export const arrangementLabel: Record<WorkArrangement, string> = {
  remote: "Télétravail",
  hybrid: "Hybride",
  onsite: "Sur site",
  unknown: "Organisation non précisée",
}

export function ResultCard({
  result,
  job,
  rank,
  selected,
  onSelect,
}: {
  result: JobMatchResult
  job?: JobOffer
  rank: number
  selected: boolean
  onSelect: () => void
}) {
  const isDemo = job?.isDemo ?? false
  return (
    <article className={`jm-result ${selected ? "is-selected" : ""}`} aria-label={`Résultat ${rank} : ${result.jobTitle}`}>
      <div className="jm-result-head">
        <div>
          <span className="jm-rank">#{rank}</span>
          <h3>{result.jobTitle}</h3>
          <p className="jm-result-meta">
            {result.company || "Entreprise non précisée"}
            {result.location ? <><span aria-hidden> · </span><MapPin size={13} /> {result.location}</> : null}
          </p>
          <div className="jm-badges">
            {isDemo && <Badge tone="warning">Offre de démonstration</Badge>}
            <Badge tone="neutral">{arrangementLabel[result.workArrangement]}</Badge>
            {result.semanticFit !== null && <Badge tone="ai"><Sparkles size={12} /> Analyse sémantique</Badge>}
          </div>
        </div>
        <div className="jm-score">
          <strong>{result.compatibilityScore}%</strong>
          <Badge tone={scoreTone(result.compatibilityScore)}>{scoreLabel(result.compatibilityScore)}</Badge>
        </div>
      </div>

      <Progress value={result.compatibilityScore} label={`${result.compatibilityScore} % de compatibilité`} />

      <div className="jm-skill-groups">
        <div>
          <h4>Compétences validées</h4>
          {result.matchedSkills.length ? (
            <ul className="jm-skill-list">
              {result.matchedSkills.map((skill) => <li key={skill}><Badge tone="success">{skill}</Badge></li>)}
            </ul>
          ) : <p className="muted">Aucune compétence commune identifiée.</p>}
        </div>
        <div>
          <h4>Compétences requises manquantes</h4>
          {result.missingRequiredSkills.length ? (
            <ul className="jm-skill-list">
              {result.missingRequiredSkills.map((skill) => <li key={skill}><Badge tone="danger">{skill}</Badge></li>)}
            </ul>
          ) : <p className="muted">Aucune lacune sur les compétences requises.</p>}
        </div>
        {result.missingPreferredSkills.length > 0 && (
          <div>
            <h4>Compétences appréciées manquantes</h4>
            <ul className="jm-skill-list">
              {result.missingPreferredSkills.map((skill) => <li key={skill}><Badge tone="warning">{skill}</Badge></li>)}
            </ul>
          </div>
        )}
      </div>

      {result.reasons.length > 0 && (
        <div className="jm-reasons">
          <h4>Pourquoi cette offre te correspond</h4>
          <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </div>
      )}

      <div className="jm-result-foot">
        {job && !job.isDemo && job.sourceUrl && (
          <a className="btn btn-ghost" href={job.sourceUrl} target="_blank" rel="noreferrer noopener">Ouvrir l’offre</a>
        )}
        {job?.isDemo && <span className="muted">Offre fictive fournie pour tester le module.</span>}
        <Button variant="secondary" aria-pressed={selected} onClick={onSelect}>
          {selected ? "Détail affiché" : "Voir le détail"}
        </Button>
      </div>
    </article>
  )
}
