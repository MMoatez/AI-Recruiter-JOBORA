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

  it("detects duplicate skills and inverted years", () => {
    const result = service.validate({ professionalSummary: "Profil", education: [{ startDate: "2025", endDate: "2022" }], experiences: [{ bulletPoints: ["Développé une API."] }], technicalSkills: ["React", "react"] })
    expect(result.issues).toContain("Des compétences techniques sont présentes en double.")
    expect(result.issues).toContain("Une période contient des dates invalides ou inversées.")
  })

  it("merges deterministic and AI validation conservatively", () => {
    const deterministic = service.validate({ professionalSummary: "Profil", education: [{}], experiences: [{ bulletPoints: ["Développé une API."] }], technicalSkills: ["Node.js"] })
    const result = service.merge(deterministic, { score: 60, checks: { readability: false }, issues: ["Formulation vague."], suggestions: ["Préciser la contribution."] })
    expect(result.status).toBe("NEEDS_WORK")
    expect(result.checks.readability).toBe(false)
    expect(result.issues).toContain("Formulation vague.")
  })
})
