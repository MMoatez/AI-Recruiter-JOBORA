import { Module } from "@nestjs/common"
import { MongooseModule } from "@nestjs/mongoose"
import { AuthModule } from "../auth/auth.module"
import { Cv, CvSchema } from "../cv/cv.schema"
import { LettreController } from "./lettre.controller"
import { CoverLetter, CoverLetterSchema } from "./lettre.schema"
import { LettreService } from "./lettre.service"

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: CoverLetter.name, schema: CoverLetterSchema },
      // Lecture seule des CV de l'utilisateur pour s'en servir comme source de la lettre.
      { name: Cv.name, schema: CvSchema },
    ]),
  ],
  controllers: [LettreController],
  providers: [LettreService],
})
export class LettreModule {}
