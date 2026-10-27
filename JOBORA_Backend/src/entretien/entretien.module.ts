import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { EntretienController } from "./entretien.controller"
import { EntretienService } from "./entretien.service"

@Module({
  imports: [AuthModule],
  controllers: [EntretienController],
  providers: [EntretienService],
})
export class EntretienModule {}
