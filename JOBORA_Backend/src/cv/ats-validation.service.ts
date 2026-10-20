import { Injectable } from "@nestjs/common"

type CvShape = {
  professionalSummary?: string
  education?: Array<{ startDate?: string; endDate?: string }>
  experiences?: Array<{ startDate?: string; endDate?: string; bulletPoints?: string[] }>
  technicalSkills?: string[]
}

type DeterministicValidation = ReturnType<AtsValidationService["validate"]>

@Injectable()
export class AtsValidationService {
  validate(cv: CvShape) {
    const issues: string[] = []
    if (!cv.professionalSummary?.trim()) issues.push("Le résumé professionnel est manquant.")
    if (!cv.technicalSkills?.length) issues.push("Aucune compétence technique n’est renseignée.")
    if (!cv.education?.length) issues.push("La section Formation est vide.")
    if (!cv.experiences?.length) issues.push("La section Expérience est vide alors que le parcours en contient peut-être une.")
    const longBullet = cv.experiences?.some((experience) => experience.bulletPoints?.some((bullet) => bullet.length > 180)) ?? false
    if (longBullet) issues.push("Un point d’expérience dépasse 180 caractères.")
    const emptyBullet = cv.experiences?.some((experience) => !experience.bulletPoints?.some((bullet) => bullet.trim())) ?? false
    if (emptyBullet) issues.push("Une expérience ne contient aucun point descriptif.")
    const normalizedSkills = (cv.technicalSkills ?? []).map((skill) => skill.trim().toLocaleLowerCase()).filter(Boolean)
    const duplicateSkills = new Set(normalizedSkills).size !== normalizedSkills.length
    if (duplicateSkills) issues.push("Des compétences techniques sont présentes en double.")
    const invalidDates = [...(cv.education ?? []), ...(cv.experiences ?? [])].some((entry) => !this.dateOrderIsValid(entry.startDate, entry.endDate))
    if (invalidDates) issues.push("Une période contient des dates invalides ou inversées.")
    const score = Math.max(0, 100 - issues.length * 10 - (longBullet ? 5 : 0))
    return {
      status: score >= 75 ? "PASS" as const : "NEEDS_WORK" as const, score,
      checks: { standardSections: Boolean(cv.professionalSummary && (cv.education?.length || cv.experiences?.length)), readability: !longBullet && !invalidDates, conciseBulletPoints: !longBullet && !emptyBullet, noGraphics: true, noTables: true, skillsPresent: Boolean(cv.technicalSkills?.length) },
      issues,
      suggestions: issues.length ? issues.map((issue) => issue.replace(/\.$/, "")) : ["Le CV respecte les règles ATS internes définies par JOBORA."],
    }
  }

  merge(deterministic: DeterministicValidation, ai: Record<string, unknown>) {
    const aiChecks = (ai.checks && typeof ai.checks === "object" ? ai.checks : {}) as Record<string, unknown>
    const checks = Object.fromEntries(Object.entries(deterministic.checks).map(([key, value]) => [key, value && aiChecks[key] !== false])) as DeterministicValidation["checks"]
    const issues = [...new Set([...deterministic.issues, ...this.stringArray(ai.issues)])]
    const suggestions = [...new Set([...deterministic.suggestions, ...this.stringArray(ai.suggestions)])]
    const aiScore = typeof ai.score === "number" ? Math.max(0, Math.min(100, ai.score)) : deterministic.score
    const score = Math.round(deterministic.score * 0.7 + aiScore * 0.3)
    return { status: score >= 75 && Object.values(checks).every(Boolean) ? "PASS" as const : "NEEDS_WORK" as const, score, checks, issues, suggestions }
  }

  private stringArray(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 20) : [] }
  private dateOrderIsValid(start?: string, end?: string) {
    if (!start || !end || /présent|aujourd|current|present/i.test(end)) return true
    const year = (value: string) => Number(value.match(/\b(19|20)\d{2}\b/)?.[0] ?? NaN)
    const [startYear, endYear] = [year(start), year(end)]
    return Number.isNaN(startYear) || Number.isNaN(endYear) || startYear <= endYear
  }
}
