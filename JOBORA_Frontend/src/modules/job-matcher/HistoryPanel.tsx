import { History, Trash2 } from "lucide-react"
import { Badge, Button, Card } from "../../components/ui"
import { statusLabel } from "./jobMatcherService"
import type { MatchSessionSummary } from "./types"

const TONES = {
  pending: "neutral",
  processing: "ai",
  completed: "success",
  failed: "danger",
} as const

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date inconnue"
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function HistoryPanel({
  sessions,
  busyId,
  onOpen,
  onDelete,
}: {
  sessions: MatchSessionSummary[]
  busyId: string
  onOpen: (session: MatchSessionSummary) => void
  onDelete: (session: MatchSessionSummary) => void
}) {
  return (
    <Card className="jm-history">
      <div className="card-heading">
        <div>
          <h2><History size={18} /> Historique des matchings</h2>
          <p>Seul ton compte peut consulter ou supprimer ces sessions.</p>
        </div>
        <Badge tone="neutral">{sessions.length} session{sessions.length > 1 ? "s" : ""}</Badge>
      </div>
      {sessions.length === 0 ? (
        <p className="muted">Aucun matching enregistré pour le moment.</p>
      ) : (
        <ul className="jm-history-list">
          {sessions.map((session) => {
            const label = formatDate(session.createdAt)
            return (
              <li key={session.id}>
                <div className="jm-history-meta">
                  <strong>{label}</strong>
                  <span>{session.jobCount} offre{session.jobCount > 1 ? "s" : ""} analysée{session.jobCount > 1 ? "s" : ""}</span>
                  {session.topScore !== null && <span>Meilleur score : {session.topScore}%</span>}
                  {session.status === "failed" && session.error && <span className="jm-history-error">{session.error}</span>}
                </div>
                <div className="jm-history-actions">
                  <Badge tone={TONES[session.status]}>{statusLabel[session.status]}</Badge>
                  {session.status === "completed" && (
                    <Button variant="ghost" onClick={() => onOpen(session)} loading={busyId === session.id}>
                      Ouvrir
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => onDelete(session)}
                    loading={busyId === session.id}
                    aria-label={`Supprimer le matching du ${label}`}
                  >
                    <Trash2 size={16} /> Supprimer
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
