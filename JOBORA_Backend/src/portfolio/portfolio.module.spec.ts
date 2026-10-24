import { JwtModule } from "@nestjs/jwt"
import { AuthModule } from "../auth/auth.module"
import { JwtAuthGuard } from "../auth/jwt-auth.guard"
import { PortfolioController } from "./portfolio.controller"
import { PortfolioModule } from "./portfolio.module"
import { PublicPortfolioController } from "./public-portfolio.controller"
import { ThrottlerGuard } from "@nestjs/throttler"

describe("PortfolioModule authentication wiring", () => {
  it("imports the configured AuthModule and reuses its exported guard", () => {
    const portfolioImports = Reflect.getMetadata("imports", PortfolioModule) as unknown[]
    const portfolioProviders = Reflect.getMetadata("providers", PortfolioModule) as unknown[]
    const authExports = Reflect.getMetadata("exports", AuthModule) as unknown[]
    const controllerGuards = Reflect.getMetadata("__guards__", PortfolioController) as unknown[]

    expect(portfolioImports).toContain(AuthModule)
    expect(portfolioProviders).not.toContain(JwtAuthGuard)
    expect(authExports).toEqual(expect.arrayContaining([JwtModule, JwtAuthGuard]))
    expect(controllerGuards).toContain(JwtAuthGuard)
  })

  it("keeps the public portfolio route unauthenticated and rate limited", () => {
    const classGuards = Reflect.getMetadata("__guards__", PublicPortfolioController) as unknown[] | undefined
    const publicHandler = PublicPortfolioController.prototype.getPublished
    const publicCvHandler = PublicPortfolioController.prototype.downloadPublishedCv
    const publicGuards = Reflect.getMetadata("__guards__", publicHandler) as unknown[]
    const publicCvGuards = Reflect.getMetadata("__guards__", publicCvHandler) as unknown[]
    const generateHandler = PortfolioController.prototype.generate
    const generateGuards = Reflect.getMetadata("__guards__", generateHandler) as unknown[]

    expect(classGuards).toBeUndefined()
    expect(publicGuards).toContain(ThrottlerGuard)
    expect(publicGuards).not.toContain(JwtAuthGuard)
    expect(Reflect.getMetadata("path", PublicPortfolioController)).toBe("public/portfolio")
    expect(Reflect.getMetadata("path", publicHandler)).toBe(":slug")
    expect(Reflect.getMetadata("THROTTLER:LIMITdefault", publicHandler)).toBe(30)
    expect(Reflect.getMetadata("path", publicCvHandler)).toBe(":slug/cv")
    expect(publicCvGuards).toContain(ThrottlerGuard)
    expect(publicCvGuards).not.toContain(JwtAuthGuard)
    expect(Reflect.getMetadata("path", PortfolioController.prototype.downloadMineCv)).toBe("me/cv")
    expect(generateGuards).toContain(ThrottlerGuard)
    expect(Reflect.getMetadata("THROTTLER:LIMITdefault", generateHandler)).toBe(5)
  })
})
