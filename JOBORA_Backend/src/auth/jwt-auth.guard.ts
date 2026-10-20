import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import type { Request } from "express"

export type AuthenticatedRequest = Request & { user: { id: string; email: string } }

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const token = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) throw new UnauthorizedException("Authentification requise.")
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; email: string }>(token)
      request.user = { id: payload.sub, email: payload.email }
      return true
    } catch {
      throw new UnauthorizedException("Session invalide ou expirée.")
    }
  }
}
