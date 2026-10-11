import {
  FileCheck2,
  FileText,
  Languages,
  LogOut,
  Palette,
  UserRound,
} from "lucide-react"
import { Button, Card, Field, PageTitle } from "../components/ui"
import { authService, readSession } from "../services/api"

export default function SettingsPage() {
  const session = readSession()
  const names = (session?.user.name || "Utilisateur").trim().split(/\s+/)
  const firstName = names[0] || "Utilisateur"
  const lastName = names.slice(1).join(" ")
  const initials = names.map((name) => name[0]).join("").slice(0, 2).toUpperCase()

  function logout() {
    authService.logout()
    window.location.replace("/")
  }

  return (
    <>
      <PageTitle
        eyebrow="Compte"
        title="Paramètres"
        description="Gère ton profil, tes préférences et la confidentialité de tes données."
      />
      <div className="settings-layout">
        <nav>
          <button className="active">
            <UserRound size={18} /> Profil
          </button>
          <button>
            <Languages size={18} /> Langue et région
          </button>
          <button>
            <Palette size={18} /> Apparence
          </button>
          <button>
            <FileText size={18} /> Mes documents
          </button>
          <button>
            <ShieldIcon /> Données et confidentialité
          </button>
        </nav>
        <Card className="settings-card">
          <div className="card-heading">
            <div>
              <h2>Informations personnelles</h2>
              <p>Ces informations sont utilisées dans tes documents.</p>
            </div>
          </div>
          <div className="profile-photo">
            <span>{initials}</span>
            <div>
              <Button variant="secondary">Changer la photo</Button>
              <small>JPG ou PNG · 2 Mo max.</small>
            </div>
          </div>
          <div className="form-grid">
            <Field label="Prénom" defaultValue={firstName} />
            <Field label="Nom" defaultValue={lastName} />
          </div>
          <Field
            label="Adresse email"
            type="email"
            defaultValue={session?.user.email || ""}
          />
          <Field label="Ville" defaultValue="Paris, France" />
          <div className="settings-footer">
            <Button>Enregistrer les modifications</Button>
          </div>
          <div className="danger-zone logout-zone">
            <div>
              <h3>Se déconnecter</h3>
              <p>Ferme ta session sur cet appareil et retourne à la page de connexion.</p>
            </div>
            <Button variant="secondary" onClick={logout}><LogOut size={17} /> Se déconnecter</Button>
          </div>
          <div className="danger-zone">
            <div>
              <h3>Supprimer mes données</h3>
              <p>
                Supprime définitivement ton compte et tous les documents
                associés.
              </p>
            </div>
            <Button variant="danger">Supprimer mon compte</Button>
          </div>
        </Card>
      </div>
    </>
  )
}

function ShieldIcon() {
  return <FileCheck2 size={18} />
}
