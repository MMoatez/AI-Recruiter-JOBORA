import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { AtsValidationService } from "./ats-validation.service"
import { CvController } from "./cv.controller"
import { CvService } from "./cv.service"
import { GeminiService } from "./gemini.service"
import { RagService } from "./rag.service"

@Module({
  imports: [AuthModule],
  controllers: [CvController],
  providers: [CvService, GeminiService, AtsValidationService, RagService],
})
export class CvModule {}
