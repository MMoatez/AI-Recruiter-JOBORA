import { identityValues, sanitizeCv, scrubText } from "./lettre.privacy"

describe("lettre.privacy", () => {
  it("retire email, téléphone, liens et nom avant l'appel IA", () => {
    const text = "Ali Ben Salah\nali.bs@mail.tn | +216 22 333 444 | linkedin.com/in/ali\nStage Flutter chez TechCorp"
    const result = scrubText(text, ["Ali Ben Salah"])
    expect(result).not.toMatch(/mail\.tn|333|linkedin|Ali|Salah/)
    expect(result).toContain("Stage Flutter chez TechCorp")
  })

  it("ne transmet jamais personalInformation ni les liens de projet", () => {
    const cv = {
      targetJob: "Développeur Flutter",
      personalInformation: { fullName: "Sarra Trabelsi", email: "s@t.tn", phone: "22 333 444" },
      experiences: [{ jobTitle: "Stagiaire", company: "TechCorp", bulletPoints: ["Flutter avec Sarra"] }],
      projects: [{ name: "Parking", link: "https://github.com/sarra/parking", technologies: ["Flutter"] }],
      technicalSkills: ["Flutter"],
    }
    const facts = sanitizeCv(cv)
    const serialized = JSON.stringify(facts)
    expect(serialized).not.toMatch(/Sarra|Trabelsi|s@t\.tn|333|github/)
    expect(facts).not.toHaveProperty("personalInformation")
    expect(serialized).toContain("TechCorp")
  })

  it("privilégie le contenu généré par le module CV quand il existe", () => {
    const facts = sanitizeCv({
      experiences: [{ jobTitle: "brut" }],
      generatedContent: { experiences: [{ jobTitle: "Développeur mobile", bulletPoints: ["Développé des écrans Flutter."] }] },
    })
    expect(JSON.stringify(facts.experiences)).toContain("Développeur mobile")
  })

  it("récupère les champs de nom et le nom du compte", () => {
    expect(identityValues({ firstName: "Ali", city: "Tunis" }, { name: "Ali Ben" })).toEqual(["Ali", "Ali Ben"])
  })
})
