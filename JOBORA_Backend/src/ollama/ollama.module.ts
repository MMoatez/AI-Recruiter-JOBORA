import { HttpModule } from "@nestjs/axios"
import { Module } from "@nestjs/common"
import { OllamaService } from "./ollama.service"

@Module({
  imports: [HttpModule.register({ timeout: 120_000 })],
  providers: [OllamaService],
  exports: [OllamaService],
})
export class OllamaModule {}
