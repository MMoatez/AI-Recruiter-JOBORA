import { INestApplication, UnauthorizedException } from "@nestjs/common"
import { Test } from "@nestjs/testing"
import request from "supertest"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { JobMatcherController } from "./job-matcher.controller"
import { JobMatcherService } from "./job-matcher.service"

describe("JobMatcherController authentication", () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobMatcherController],
      providers: [{ provide: JobMatcherService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => { throw new UnauthorizedException() } })
      .compile()
    app = moduleRef.createNestApplication()
    await app.listen(0)
  })

  afterAll(async () => { await app.close() })

  it("rejects unauthenticated calls on every route", async () => {
    const calls = [
      request(app.getHttpServer()).get("/job-matcher/jobs"),
      request(app.getHttpServer()).post("/job-matcher/jobs").send({ title: "x", description: "y" }),
      request(app.getHttpServer()).post("/job-matcher/cv").send({ cvId: "cv-1" }),
      request(app.getHttpServer()).get("/job-matcher/profile/cv-1"),
      request(app.getHttpServer()).put("/job-matcher/profile/cv-1").send({ profile: {} }),
      request(app.getHttpServer()).post("/job-matcher/match").send({ cvId: "cv-1" }),
      request(app.getHttpServer()).get("/job-matcher/status/match-1"),
      request(app.getHttpServer()).get("/job-matcher/results/match-1"),
      request(app.getHttpServer()).get("/job-matcher/history"),
      request(app.getHttpServer()).delete("/job-matcher/history/match-1"),
    ]
    for (const call of calls) {
      const response = await call
      expect(response.status).toBe(401)
    }
  })
})
