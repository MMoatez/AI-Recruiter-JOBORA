import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, FileCheck2, LockKeyhole, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react"
import { Button, Field } from "../components/ui"
import { ApiError, authService } from "../services/api"

type Mode = "login" | "register"

function AuthVisual() {
  return (
    <section className="auth-visual">
      <div className="visual-orb orb-one" /><div className="visual-orb orb-two" />
      <div className="visual-content">
        <div className="brand brand-light"><div className="brand-mark"><Sparkles size={20} /></div><span>AI Recruiter</span></div>
        <div className="visual-copy">
          <span className="ai-pill"><Sparkles size={15} /> CV assisté par Gemini</span>
          <h1>Construis un CV <em>professionnel et ATS-friendly.</em></h1>
          <p>Crée, améliore et valide plusieurs CV dans un espace personnel sécurisé.</p>
          <div className="benefit-list">
            <div><span><FileCheck2 size={22} /></span><p><strong>Gestion complète des CV</strong><small>Création, édition, génération et validation ATS.</small></p></div>
            <div><span><ShieldCheck size={22} /></span><p><strong>Données privées</strong><small>Chaque compte accède uniquement à ses propres CV.</small></p></div>
          </div>
        </div>
        <div className="visual-trust"><CheckCircle2 size={18} /><span><strong>Backend sécurisé</strong><small>NestJS, MongoDB et JWT</small></span></div>
      </div>
    </section>
  )
}

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError("")
    try {
      if (mode === "register") await authService.register({ name, email, password })
      else await authService.login({ email, password })
      navigate("/app", { replace: true })
    } catch (value) {
      setError(value instanceof ApiError ? value.message : "Une erreur inattendue est survenue.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page">
      <AuthVisual />
      <section className="auth-panel">
        <div className="auth-box">
          <div className="auth-title"><h2>{mode === "login" ? "Ravi de te revoir" : "Crée ton espace CV"}</h2><p>{mode === "login" ? "Connecte-toi pour gérer tes CV." : "Crée un compte sécurisé en quelques secondes."}</p></div>
          <div className="auth-tabs" role="tablist">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => { setMode("login"); setError("") }}>Connexion</button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError("") }}>Inscription</button>
          </div>
          {error && <div className="global-error"><AlertCircle size={18} /><span><strong>Impossible de continuer</strong>{error}</span></div>}
          <form onSubmit={submit} className="auth-form">
            {mode === "register" && <Field label="Nom complet" value={name} onChange={(event) => setName(event.target.value)} placeholder="Prénom Nom" icon={<UserRound size={18} />} required />}
            <Field label="Adresse email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@email.com" icon={<Mail size={18} />} required />
            <Field label="Mot de passe" type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" minLength={8} icon={<LockKeyhole size={18} />} trailing={<button type="button" className="field-action" onClick={() => setVisible(!visible)} aria-label="Afficher le mot de passe">{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>} required />
            <Button variant="ai" className="full" loading={loading}>{mode === "login" ? "Se connecter" : "Créer mon compte"}<ArrowRight size={17} /></Button>
          </form>
          <p className="auth-legal"><ShieldCheck size={14} /> Ta clé Gemini reste uniquement sur le serveur.</p>
        </div>
      </section>
    </main>
  )
}
