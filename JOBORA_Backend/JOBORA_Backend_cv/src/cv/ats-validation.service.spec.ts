import { AtsValidationService } from "./ats-validation.service"

describe("AtsValidationService", () => {
  const service = new AtsValidationService()

  it("passes a complete concise CV", () => {
    const result = service.validate({ professionalSummary: "Développeur web.", education: [{}], experiences: [{ bulletPoints: ["Développé une interface React."] }], technicalSkills: ["React"] })
    expect(result.status).toBe("PASS")
    expect(result.score).toBe(100)
  })

  it("detects a missing summary", () => {
    expect(service.validate({ education: [{}], experiences: [{}], technicalSkills: ["React"] }).issues).toContain("Le résumé professionnel est manquant.")
  })

  it("detects missing skills", () => {
    expect(service.validate({ professionalSummary: "Profil", education: [{}], experiences: [{}] }).checks.skillsPresent).toBe(false)
  })

  it("detects excessively long bullet points", () => {
    const result = service.validate({ professionalSummary: "Profil", education: [{}], experiences: [{ bulletPoints: ["x".repeat(181)] }], technicalSkills: ["React"] })
    expect(result.checks.conciseBulletPoints).toBe(false)
  })
})
