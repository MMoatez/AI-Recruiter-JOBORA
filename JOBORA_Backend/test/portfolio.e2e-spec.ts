import { Module, ValidationPipe } from "@nestjs/common"
import { JwtModule, JwtService } from "@nestjs/jwt"
import { Test } from "@nestjs/testing"
import { getModelToken, MongooseModule } from "@nestjs/mongoose"
import { ThrottlerModule } from "@nestjs/throttler"
import os = require("node:os")
import type { Model } from "mongoose"
import { Types } from "mongoose"
import request from "supertest"
import type { INestApplication } from "@nestjs/common"
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard"
import { OllamaService } from "../src/ollama/ollama.service"
import { PortfolioController } from "../src/portfolio/portfolio.controller"
import { Portfolio, PortfolioDocument, PortfolioSchema } from "../src/portfolio/portfolio.schema"
import { PortfolioService } from "../src/portfolio/portfolio.service"
import { PublicPortfolioController } from "../src/portfolio/public-portfolio.controller"
import { emptyPortfolioData } from "../src/portfolio/portfolio-data"

const TEST_JWT_SECRET = "portfolio-e2e-test-secret"
const TEST_MONGODB_URI = "mongodb://127.0.0.1:27017/ai_recruiter_test"

@Module({
  imports: [
    MongooseModule.forRoot(TEST_MONGODB_URI, {
      retryAttempts: 1,
      retryDelay: 0,
      serverSelectionTimeoutMS: 3000,
      runtimeAdapters: { os },
    }),
    MongooseModule.forFeature([{ name: Portfolio.name, schema: PortfolioSchema }]),
    JwtModule.register({ secret: TEST_JWT_SECRET }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [PortfolioController, PublicPortfolioController],
  providers: [PortfolioService, JwtAuthGuard, OllamaService],
})
class PortfolioE2eModule {}

describe("Portfolio HTTP (e2e)", () => {
  const ollamaMock = {
    generateJson: jest.fn(),
    embed: jest.fn(),
  }
  const createdUserIds: Types.ObjectId[] = []
  let app: INestApplication
  let portfolios: Model<PortfolioDocument>
  let jwt: JwtService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PortfolioE2eModule],
    })
      .overrideProvider(OllamaService)
      .useValue(ollamaMock)
      .compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix("api")
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }))
    await app.init()
    portfolios = app.get<Model<PortfolioDocument>>(getModelToken(Portfolio.name))
    jwt = app.get(JwtService, { strict: false })
  }, 20_000)

  afterEach(async () => {
    if (createdUserIds.length) {
      await portfolios.deleteMany({ userId: { $in: createdUserIds } })
      createdUserIds.length = 0
    }
  })

  afterAll(async () => {
    await app?.close()
  })

  async function createUserId(): Promise<Types.ObjectId> {
    const id = new Types.ObjectId()
    createdUserIds.push(id)
    return id
  }

  async function tokenFor(userId: Types.ObjectId): Promise<string> {
    return jwt.signAsync({ sub: userId.toString(), email: `${userId.toString()}@example.test` })
  }

  async function createPortfolio(options: {
    userId?: Types.ObjectId
    slug?: string
    status?: "draft" | "published"
    data?: Partial<ReturnType<typeof emptyPortfolioData>>
  } = {}) {
    const userId = options.userId ?? await createUserId()
    const slug = options.slug ?? `portfolio-${new Types.ObjectId().toString()}`
    const data = { ...emptyPortfolioData(), ...options.data }
    return portfolios.create({
      userId,
      slug,
      status: options.status ?? "draft",
      data,
      publishedAt: options.status === "published" ? new Date() : null,
    })
  }

  it("rejects portfolio generation without a token", async () => {
    await request(app.getHttpServer())
      .post("/api/portfolio/generate")
      .expect(401)
  })

  it("rejects DOCX uploads and PDFs larger than 5 MiB", async () => {
    const userId = await createUserId()
    const token = await tokenFor(userId)

    await request(app.getHttpServer())
      .post("/api/portfolio/generate")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.from("not a PDF"), {
        filename: "resume.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      })
      .expect(400)

    await request(app.getHttpServer())
      .post("/api/portfolio/generate")
      .set("Authorization", `Bearer ${token}`)
      .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      })
      .expect(413)
  })

  it("scopes portfolio reads, updates, and deletes to the authenticated user", async () => {
    const userA = await createUserId()
    const userB = await createUserId()
    const portfolioB = await createPortfolio({
      userId: userB,
      data: { fullName: "User B", headline: "B's private portfolio" },
    })
    const tokenA = await tokenFor(userA)

    await request(app.getHttpServer())
      .get("/api/portfolio/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(404)

    await request(app.getHttpServer())
      .put("/api/portfolio/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ ...emptyPortfolioData(), fullName: "User A", headline: "A's portfolio" })
      .expect(200)

    let unchangedPortfolioB = await portfolios.findById(portfolioB._id).lean().exec()
    expect(unchangedPortfolioB?.data.fullName).toBe("User B")
    expect(unchangedPortfolioB?.data.headline).toBe("B's private portfolio")

    await request(app.getHttpServer())
      .delete("/api/portfolio/me")
      .set("Authorization", `Bearer ${tokenA}`)
      .expect(200)

    unchangedPortfolioB = await portfolios.findById(portfolioB._id).lean().exec()
    expect(unchangedPortfolioB?.data.fullName).toBe("User B")
    expect(unchangedPortfolioB?.data.headline).toBe("B's private portfolio")
  })

  it("serves only published public fields without authentication", async () => {
    const published = await createPortfolio({
      slug: `public-${new Types.ObjectId().toString()}`,
      status: "published",
      data: {
        fullName: "Public User",
        email: "private@example.test",
        phone: "+33123456789",
        contactVisibility: { email: false, phone: false },
      },
    })

    const response = await request(app.getHttpServer())
      .get(`/api/public/portfolio/${published.slug}`)
      .expect(200)

    expect(response.body).not.toHaveProperty("userId")
    expect(response.body).not.toHaveProperty("removedItems")
    expect(response.body.data).not.toHaveProperty("email")
    expect(response.body.data).not.toHaveProperty("phone")
  })

  it("returns 404 after unpublishing and for an unknown public slug", async () => {
    const userId = await createUserId()
    const published = await createPortfolio({
      userId,
      slug: `unpublish-${new Types.ObjectId().toString()}`,
      status: "published",
    })
    const token = await tokenFor(userId)

    await request(app.getHttpServer())
      .post("/api/portfolio/me/unpublish")
      .set("Authorization", `Bearer ${token}`)
      .expect(201)

    await request(app.getHttpServer())
      .get(`/api/public/portfolio/${published.slug}`)
      .expect(404)

    await request(app.getHttpServer())
      .get(`/api/public/portfolio/not-a-real-slug-${new Types.ObjectId().toString()}`)
      .expect(404)
  })

  it("rejects an invalid portfolio update body", async () => {
    const token = await tokenFor(await createUserId())

    await request(app.getHttpServer())
      .put("/api/portfolio/me")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "not-an-email" })
      .expect(400)
  })
})
