import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { compare, hash } from "bcryptjs"
import { randomUUID } from "node:crypto"
import { DatabaseService } from "../database/database.service"
import { LoginDto, RegisterDto } from "./dto/auth.dto"

@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase()
    const user = { id: randomUUID(), name: dto.name?.trim() || email.split("@")[0], email, passwordHash: await hash(dto.password, 12) }
    try {
      this.database.connection.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(user.id, user.name, email, user.passwordHash, this.database.now())
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) throw new ConflictException("Un compte existe déjà avec cet email.")
      throw error
    }
    return this.createSession(user)
  }

  async login(dto: LoginDto) {
    const user = this.database.connection.prepare("SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ? COLLATE NOCASE")
      .get(dto.email.toLowerCase()) as { id: string; name: string; email: string; passwordHash: string } | undefined
    if (!user || !(await compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Email ou mot de passe incorrect.")
    return this.createSession(user)
  }

  async currentUser(id: string) {
    const user = this.database.connection.prepare("SELECT id, name, email FROM users WHERE id = ?").get(id) as { id: string; name: string; email: string } | undefined
    if (!user) throw new UnauthorizedException("Session invalide ou expirée.")
    return user
  }

  private async createSession(user: { id: string; name: string; email: string }) {
    const payload = { sub: user.id, email: user.email }
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.jwt.signAsync(payload, { expiresIn: "7d" }),
      user: { id: user.id, name: user.name, email: user.email },
    }
  }
}
