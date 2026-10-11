import { Injectable } from "@nestjs/common"

type CvShape = {
  professionalSummary?: string
  education?: unknown[]
  experiences?: Array<{ bulletPoints?: string[] }>
  technicalSkills?: string[]
}

@Injectable()
export class AtsValidationService {
  validate(cv: CvShape) {
    const issues: string[] = []
    if (!cv.professionalSummary?.trim()) issues.push("Le résumé professionnel est manquant.")
    if (!cv.technicalSkills?.length) issues.push("Aucune compétence technique n’est renseignée.")
    if (!cv.education?.length) issues.push("La section Formation est vide.")
    if (!cv.experiences?.length) issues.push("La section Expérience est vide.")
    const longBullet = cv.experiences?.some((experience) => experience.bulletPoints?.some((bullet) => bullet.length > 180)) ?? false
    if (longBullet) issues.push("Un point d’expérience dépasse 180 caractères.")
    const score = Math.max(0, 100 - issues.length * 12 - (longBullet ? 4 : 0))
    return {
      status: score >= 75 ? "PASS" : "NEEDS_WORK",
      score,
      checks: {
        standardSections: Boolean(cv.professionalSummary && (cv.education?.length || cv.experiences?.length)),
        readability: !longBullet,
        conciseBulletPoints: !longBullet,
        noGraphics: true,
        noTables: true,
        skillsPresent: Boolean(cv.technicalSkills?.length),
      },
      issues,
      suggestions: issues.length ? issues.map((issue) => issue.replace(/\.$/, "")) : ["Le CV respecte les règles internes ATS définies par AI Recruiter."],
    }
  }
}
