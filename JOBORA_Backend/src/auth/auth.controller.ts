import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common"
import { CurrentUser } from "./current-user.decorator"
import { AuthService } from "./auth.service"
import { LoginDto, RegisterDto } from "./dto/auth.dto"
import { JwtAuthGuard } from "./jwt-auth.guard"

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) { return this.auth.register(dto) }

  @Post("login")
  login(@Body() dto: LoginDto) { return this.auth.login(dto) }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: { id: string }) { return this.auth.currentUser(user.id) }
}
