import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { AuthModule } from "../auth/auth.module"
import { AtsValidationService } from "./ats-validation.service"
import { CvController } from "./cv.controller"
import { Cv, CvSchema } from "./cv.schema"
import { CvService } from "./cv.service"
import { GeminiService } from "./gemini.service"

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: Cv.name, schema: CvSchema }])],
  controllers: [CvController],
  providers: [CvService, GeminiService, AtsValidationService],
})
export class CvModule {}
