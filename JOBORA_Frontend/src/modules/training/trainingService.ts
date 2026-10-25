import { protectedRequest } from "../../services/api.ts"
import type { Analysis, Mastery, Plan, ProgressItem, Recommendation, Result, Session } from "./types"

export const trainingService = {
  analyze: (body: unknown) => protectedRequest<Analysis>("/training/analyze", { method: "POST", body: JSON.stringify(body) }),
  plan: (id: string) => protectedRequest<Plan>(`/training/plans/${encodeURIComponent(id)}`),
  progress: (planId: string, taskId: string, body: unknown) => protectedRequest<ProgressItem>(`/training/plans/${encodeURIComponent(planId)}/tasks/${encodeURIComponent(taskId)}/progress`, { method: "PATCH", body: JSON.stringify(body) }),
  assessment: (skill: string, planId: string) => protectedRequest<Session>("/training/assessments", { method: "POST", body: JSON.stringify({ skill, plan_id: planId }) }),
  submit: (id: string, answers: Array<{ question_id: string; selected_choice: number }>) => protectedRequest<Result>(`/training/assessments/${encodeURIComponent(id)}/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  mastery: () => protectedRequest<Mastery[]>("/training/mastery"),
  recommendations: () => protectedRequest<Recommendation[]>("/training/recommendations"),
}
