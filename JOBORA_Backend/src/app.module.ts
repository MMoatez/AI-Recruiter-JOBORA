import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { DatabaseModule } from "./database/database.module"
import { AuthModule } from "./auth/auth.module"
import { CvModule } from "./cv/cv.module"
import { EntretienModule } from "./entretien/entretien.module"
import { JobMatcherModule } from "./job-matcher/job-matcher.module"
import { LettreModule } from "./lettre/lettre.module"
import { PortfolioModule } from "./portfolio/portfolio.module"
import { PublicPortfolioModule } from "./portfolio/public-portfolio.module"
import { MatchingModule } from "./matching/matching.module"
import { TrainingModule } from "./training/training.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    CvModule,
    EntretienModule,
    JobMatcherModule,
    LettreModule,
    PortfolioModule,
    PublicPortfolioModule,
    MatchingModule,
    TrainingModule,
  ],
})
export class AppModule {}
