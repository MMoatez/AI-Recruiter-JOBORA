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
    public status: number,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

const wait = (duration = 650) => new Promise((resolve) => window.setTimeout(resolve, duration))
const frontendEnv = (import.meta as ImportMeta & { env?: { VITE_API_URL?: string; VITE_DEMO_MODE?: string } }).env
const API_BASE = (frontendEnv?.VITE_API_URL || "http://localhost:3000/api").replace(/\/$/, "")
const DEMO_MODE = frontendEnv?.VITE_DEMO_MODE === "true"
let redirectingToLogin = false

function redirectToLogin() {
  localStorage.removeItem("ai-recruiter.session")
  if (!redirectingToLogin && window.location.pathname !== "/") {
    redirectingToLogin = true
    window.location.replace("/")
  }
}

export async function entretienRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readSession()?.accessToken
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json")
  const response = await fetch(`${API_BASE}/entretien${path}`, { ...init, headers })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message
    throw new ApiError(response.status, message || "La demande n'a pas abouti.")
  }
  return body as T
}

export async function protectedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = readSession()?.accessToken
  const headers = new Headers(init.headers)
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json")
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers }).catch(() => {
    throw new ApiError(0, "Impossible de joindre le serveur.")
  })
  const body = await response.json().catch(() => ({}))
  if (response.status === 401) {
    expireSession()
    throw new ApiError(401, "Ta session a expiré, reconnecte-toi.")
  }
  if (!response.ok) {
    const message = Array.isArray(body.message) ? body.message[0] : body.message
    throw new ApiError(response.status, message || "La demande n'a pas abouti.")
  }
  return body as T
}

async function backendAuth(path: string, payload: AuthPayload): Promise<AuthSession | null> {
  const response = await fetch(`${API_BASE}/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
  }).catch(() => {
    if (DEMO_MODE) return null
    throw new ApiError(0, "Impossible de joindre le serveur.")
  })
  if (!response) return null
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string | string[] }
    const message = Array.isArray(body.message) ? body.message[0] : body.message
    throw new ApiError(response.status, message || "Le serveur a refusé la demande.")
  }
  return response.json() as Promise<AuthSession>
}

function persist(session: AuthSession) {
  localStorage.setItem("ai-recruiter.session", JSON.stringify(session))
  redirectingToLogin = false
  return session
}

export function readSession(): AuthSession | null {
  try {
    return JSON.parse(localStorage.getItem("ai-recruiter.session") || "null") as AuthSession | null
  } catch {
    return null
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { authenticated?: boolean } = {},
): Promise<T> {
  const authenticated = options.authenticated ?? true
  const session = readSession()
  if (authenticated && !session?.accessToken) {
    redirectToLogin()
    throw new ApiError(401, "Connecte-toi pour accéder à cette ressource.")
  }

  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  if (authenticated && session?.accessToken) {
    headers.set("Authorization", `Bearer ${session.accessToken}`)
  }

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur. Vérifie ta connexion puis réessaie.")
  }

  if (!response.ok) {
    let message = "Le serveur n’a pas pu traiter la demande."
    try {
      const body = await response.json() as { message?: string | string[] }
      if (Array.isArray(body.message)) message = body.message.join(" ")
      else if (body.message) message = body.message
    } catch {
      message = response.statusText || message
    }
    if (authenticated && response.status === 401) {
      redirectToLogin()
    }
    throw new ApiError(response.status, message)
  }

  try {
    return await response.json() as T
  } catch {
    throw new ApiError(response.status, "La réponse du serveur est invalide.")
  }
}

export function expireSession() {
  localStorage.removeItem("ai-recruiter.session")
  window.location.replace("/")
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
  async restoreSession(): Promise<AuthSession | null> {
    const session = readSession()
    if (!session?.accessToken) return null
    if (DEMO_MODE && session.accessToken.startsWith("mock-")) return session
    if (session.accessToken.split(".").length !== 3) {
      this.logout()
      return null
    }
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      })
      if (response.status === 401) {
        this.logout()
        return null
      }
      if (!response.ok) return session
      const user = await response.json() as AuthSession["user"]
      return persist({ ...session, user })
    } catch {
      return session
    }
  },
  logout() {
    localStorage.removeItem("ai-recruiter.session")
  },
  hasSession() {
    const token = readSession()?.accessToken
    return Boolean(token && (DEMO_MODE && token.startsWith("mock-") || token.split(".").length === 3))
  },
}
