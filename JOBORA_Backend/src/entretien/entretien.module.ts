import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { AuthModule } from "../auth/auth.module"
import { EntretienController } from "./entretien.controller"
import { EntretienService } from "./entretien.service"
import { PrepSession, PrepSessionSchema } from "./entretien.schema"

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: PrepSession.name, schema: PrepSessionSchema }])],
  controllers: [EntretienController],
  providers: [EntretienService],
})
export class EntretienModule {}
