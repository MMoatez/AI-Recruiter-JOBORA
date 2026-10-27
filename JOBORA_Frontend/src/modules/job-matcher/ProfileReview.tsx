import { Save, Sparkles } from "lucide-react"
import { Badge, Button, Card, Field, Select } from "../../components/ui"
import { splitList } from "./jobMatcherService"
import type { CandidateProfile, Seniority } from "./types"

const SENIORITY_LABELS: Array<[Seniority, string]> = [
  ["junior", "Junior (0–2 ans)"],
  ["mid", "Confirmé (3–5 ans)"],
  ["senior", "Senior (5 ans et +)"],
  ["unknown", "Non précisé"],
]

export function ProfileReview({
  profile,
  busy,
  onChange,
  onContinue,
}: {
  profile: CandidateProfile
  busy: boolean
  onChange: (patch: Partial<CandidateProfile>) => void
  onContinue: () => void
}) {
  return (
    <Card className="jm-profile">
      <div className="card-heading">
        <div>
          <h2>Profil extrait de ton CV</h2>
          <p>Seules les informations présentes dans ton CV sont reprises. Corrige-les si nécessaire : elles servent au calcul de compatibilité.</p>
        </div>
        <Badge tone="ai"><Sparkles size={12} /> IA + analyse locale</Badge>
      </div>

      <div className="jm-form-grid">
        <Field
          label="Compétences (séparées par des virgules)"
          value={profile.skills.join(", ")}
          onChange={(event) => onChange({ skills: splitList(event.target.value) })}
          maxLength={1500}
        />
        <Field
          label="Intitulés de poste visés"
          value={profile.jobTitles.join(", ")}
          onChange={(event) => onChange({ jobTitles: splitList(event.target.value) })}
          maxLength={600}
        />
        <Field
          label="Années d’expérience"
          type="number"
          min={0}
          max={60}
          step={0.5}
          value={profile.experienceYears ?? ""}
          onChange={(event) => onChange({ experienceYears: event.target.value === "" ? null : Number(event.target.value) })}
          hint="Laisse vide si ton CV ne permet pas de la déterminer."
        />
        <Select
          label="Niveau de séniorité"
          value={profile.seniority}
          onChange={(event) => onChange({ seniority: event.target.value as Seniority })}
          options={SENIORITY_LABELS}
        />
        <Field
          label="Langues"
          value={profile.languages.join(", ")}
          onChange={(event) => onChange({ languages: splitList(event.target.value) })}
          maxLength={400}
        />
        <Field
          label="Formation"
          value={profile.education.join(", ")}
          onChange={(event) => onChange({ education: splitList(event.target.value) })}
          maxLength={600}
        />
        <Field
          label="Certifications"
          value={profile.certifications.join(", ")}
          onChange={(event) => onChange({ certifications: splitList(event.target.value) })}
          maxLength={600}
        />
        <Field
          label="Localisations préférées"
          value={profile.preferredLocations.join(", ")}
          onChange={(event) => onChange({ preferredLocations: splitList(event.target.value) })}
          maxLength={400}
        />
      </div>

      <div className="jm-form-actions">
        <p className="muted">Le score reste indicatif : il ne garantit ni entretien ni recrutement.</p>
        <Button variant="primary" onClick={onContinue} loading={busy}>
          <Save size={17} /> Enregistrer et choisir les offres
        </Button>
      </div>
    </Card>
  )
}
