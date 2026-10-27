import { Module } from "@nestjs/common"
import { AuthModule } from "../auth/auth.module"
import { JobMatcherAiClient } from "./job-matcher-ai.client"
import { JobMatcherController } from "./job-matcher.controller"
import { JobMatcherService } from "./job-matcher.service"

@Module({
  imports: [AuthModule],
  controllers: [JobMatcherController],
  providers: [JobMatcherAiClient, JobMatcherService],
})
export class JobMatcherModule {}
