import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { MongooseModule } from "@nestjs/mongoose"
import { AuthModule } from "./auth/auth.module"
import { CvModule } from "./cv/cv.module"
import { EntretienModule } from "./entretien/entretien.module"

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>("MONGODB_URI"),
        serverSelectionTimeoutMS: 5000,
      }),
    }),
    AuthModule,
    CvModule,
    EntretienModule,
  ],
})
export class AppModule {}
