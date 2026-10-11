import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"
import { InjectModel } from "@nestjs/mongoose"
import { compare, hash } from "bcryptjs"
import { Model } from "mongoose"
import { User, UserDocument } from "../users/user.schema"
import { LoginDto, RegisterDto } from "./dto/auth.dto"

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase()
    if (await this.users.exists({ email })) throw new ConflictException("Un compte existe déjà avec cet email.")
    const user = await this.users.create({
      name: dto.name?.trim() || email.split("@")[0],
      email,
      passwordHash: await hash(dto.password, 12),
    })
    return this.createSession(user)
  }

  async login(dto: LoginDto) {
    const user = await this.users.findOne({ email: dto.email.toLowerCase() }).select("+passwordHash")
    if (!user || !(await compare(dto.password, user.passwordHash))) throw new UnauthorizedException("Email ou mot de passe incorrect.")
    return this.createSession(user)
  }

  private async createSession(user: UserDocument) {
    const payload = { sub: user.id, email: user.email }
    return {
      accessToken: await this.jwt.signAsync(payload),
      refreshToken: await this.jwt.signAsync(payload, { expiresIn: "7d" }),
      user: { id: user.id, name: user.name, email: user.email },
    }
  }
}
