import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { LettreController } from "./lettre.controller"
import { LettreService } from "./lettre.service"

@Module({
  imports: [AuthModule],
  controllers: [LettreController],
  providers: [LettreService],
})
export class LettreModule {}
