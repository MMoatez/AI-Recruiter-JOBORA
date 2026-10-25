export type AuthPayload = {
  email: string
  password: string
  name?: string
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: { id: string; name: string; email: string }
}

export class ApiError extends Error {
  constructor(
    public status: 401 | 409 | 422 | 500,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message)
  }
}

const wait = (duration = 650) => new Promise((resolve) => window.setTimeout(resolve, duration))
const frontendEnv = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string; VITE_DEMO_MODE?: string } }).env
const API_BASE = (frontendEnv?.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "")
const DEMO_MODE = frontendEnv?.VITE_DEMO_MODE === "true"

async function backendAuth(path: string, payload: AuthPayload): Promise<AuthSession | null> {
  try {
    const response = await fetch(`${API_BASE}/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { message?: string | string[] }
      const message = Array.isArray(body.message) ? body.message[0] : body.message
      throw new ApiError(response.status === 401 ? 401 : response.status === 409 ? 409 : response.status === 400 ? 422 : 500, message || "Le serveur a refusé la demande.")
    }
    return response.json() as Promise<AuthSession>
  } catch (error) {
    if (error instanceof ApiError) throw error
    return null
  }
}

function persist(session: AuthSession) {
  localStorage.setItem("ai-recruiter.session", JSON.stringify(session))
  return session
}

export function readSession(): AuthSession | null {
  try {
    return JSON.parse(localStorage.getItem("ai-recruiter.session") || "null") as AuthSession | null
  } catch {
    return null
  }
}

export const authService = {
  async login(payload: AuthPayload): Promise<AuthSession> {
    const backendSession = await backendAuth("login", payload)
    if (backendSession) return persist(backendSession)
    if (!DEMO_MODE) throw new ApiError(500, "Le serveur d’authentification est indisponible.")
    await wait()
    if (!payload.email || !payload.password) throw new ApiError(422, "Certains champs sont incomplets.")
    if (payload.email === "erreur@demo.fr") throw new ApiError(401, "Email ou mot de passe incorrect.")
    return persist({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      user: { id: "usr_thomas", name: "Thomas Martin", email: payload.email },
    })
  },
  async register(payload: AuthPayload): Promise<AuthSession> {
    const backendSession = await backendAuth("register", payload)
    if (backendSession) return persist(backendSession)
    if (!DEMO_MODE) throw new ApiError(500, "Le serveur d’authentification est indisponible.")
    await wait()
    if (payload.email === "existe@demo.fr") throw new ApiError(409, "Un compte existe déjà avec cet email.")
    if (payload.password.length < 8) throw new ApiError(422, "Le mot de passe est trop court.", { password: "Utilise au moins 8 caractères." })
    return persist({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      user: { id: "usr_thomas", name: payload.name || "Thomas Martin", email: payload.email },
    })
  },
  logout() {
    localStorage.removeItem("ai-recruiter.session")
  },
  hasSession() {
    return Boolean(readSession())
  },
}
