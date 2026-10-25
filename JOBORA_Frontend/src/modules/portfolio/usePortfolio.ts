import { useCallback, useEffect, useReducer } from "react"
import {
  extractPortfolioFromCv,
  generatePortfolio,
  getMyPortfolio,
  portfolioSourceTextFromCv,
  regenerateAbout as requestRegenerateAbout,
  updatePortfolio,
  setTemplate,
  syncPortfolio as requestSyncPortfolio,
  publishPortfolio as requestPublishPortfolio,
  unpublishPortfolio as requestUnpublishPortfolio,
  type PortfolioData,
  type PortfolioRecord,
  type PortfolioTemplateId,
} from "../../api/portfolioApi"
import { ApiError } from "../../services/api"
import { cvService } from "../cv/cvService"
import type { CV } from "../cv/types"

type PortfolioPathValues = {
  [K in keyof PortfolioData]: PortfolioData[K]
} & {
  templateId: PortfolioTemplateId
  "theme.accentColor": string
  "contactVisibility.email": boolean
  "contactVisibility.phone": boolean
  "links.linkedin": string
  "links.github": string
  "links.website": string
  "skills.languages": string[]
  "skills.frameworks": string[]
  "skills.tools": string[]
  "skills.databases": string[]
  "skills.other": string[]
}

type PortfolioPath = keyof PortfolioPathValues
export type PortfolioUpdate = <K extends PortfolioPath>(
  path: K,
  value: PortfolioPathValues[K],
) => void

type UpdateAction = {
  [K in PortfolioPath]: {
    type: "update"
    path: K
    value: PortfolioPathValues[K]
  }
}[PortfolioPath]

export type PortfolioEditorDraft = PortfolioData & { templateId: PortfolioTemplateId }

export const PORTFOLIO_PREVIEW_DRAFT_KEY = "ai-recruiter.portfolio-preview-draft"

type State = {
  draft: PortfolioEditorDraft
  saved: PortfolioEditorDraft
  loading: boolean
  saving: boolean
  error: string | null
  hasPortfolio: boolean | null
  existingCv: CV | null
  generating: boolean
  generationStep: number
  regeneratingAbout: boolean
  syncing: boolean
  lastSyncedAt: string | null
  status: PortfolioRecord["status"]
  slug: string | null
}

type Action =
  | { type: "loaded"; data: PortfolioData; templateId?: PortfolioTemplateId; lastSyncedAt?: string | null; status?: PortfolioRecord["status"]; slug?: string }
  | { type: "missing"; existingCv: CV | null }
  | { type: "load-failed"; error: string }
  | { type: "generation-started" }
  | { type: "generation-step"; step: number }
  | { type: "generation-failed"; error: string }
  | { type: "regenerating-about" }
  | { type: "about-regenerated"; about: string; submittedAbout: string }
  | { type: "regenerate-about-failed"; error: string }
  | { type: "saving" }
  | { type: "saved"; submitted: PortfolioEditorDraft; data: PortfolioEditorDraft; lastSyncedAt: string | null; status: PortfolioRecord["status"]; slug?: string }
  | { type: "save-failed"; error: string }
  | { type: "sync-started" }
  | { type: "sync-completed"; record: PortfolioRecord }
  | { type: "sync-failed"; error: string }
  | { type: "publish-completed"; record: PortfolioRecord }
  | { type: "unpublish-completed"; record: PortfolioRecord }
  | { type: "reset" }
  | UpdateAction

const emptyPortfolioData = (): PortfolioData => ({
  fullName: "",
  title: "",
  headline: "",
  availableForWork: true,
  showCvDownload: false,
  email: "",
  phone: "",
  location: "",
  links: { linkedin: "", github: "", website: "" },
  sections: [
    { id: "home", visible: true, order: 0 },
    { id: "about", visible: true, order: 1 },
    { id: "skills", visible: true, order: 2 },
    { id: "experiences", visible: true, order: 3 },
    { id: "projects", visible: true, order: 4 },
    { id: "certifications", visible: true, order: 5 },
    { id: "contact", visible: true, order: 6 },
  ],
  theme: { accentColor: "#5b5bd6" },
  contactVisibility: { email: false, phone: false },
  about: "",
  education: [],
  experiences: [],
  projects: [],
  skills: { languages: [], frameworks: [], tools: [], databases: [], other: [] },
  languages: [],
  certifications: [],
})

function cloneData(data: PortfolioData): PortfolioData {
  return structuredClone(data)
}

function cloneDraft(draft: PortfolioEditorDraft): PortfolioEditorDraft {
  return structuredClone(draft)
}

function applyUpdate<K extends PortfolioPath>(
  draft: PortfolioEditorDraft,
  path: K,
  value: PortfolioPathValues[K],
): PortfolioEditorDraft {
  switch (path) {
    case "templateId":
      return { ...draft, templateId: value as PortfolioTemplateId }
    case "theme.accentColor":
      return { ...draft, theme: { ...draft.theme, accentColor: value as string } }
    case "contactVisibility.email":
      return { ...draft, contactVisibility: { ...draft.contactVisibility, email: value as boolean } }
    case "contactVisibility.phone":
      return { ...draft, contactVisibility: { ...draft.contactVisibility, phone: value as boolean } }
    case "links.linkedin":
      return { ...draft, links: { ...draft.links, linkedin: value as string } }
    case "links.github":
      return { ...draft, links: { ...draft.links, github: value as string } }
    case "links.website":
      return { ...draft, links: { ...draft.links, website: value as string } }
    case "skills.languages":
      return { ...draft, skills: { ...draft.skills, languages: value as string[] } }
    case "skills.frameworks":
      return { ...draft, skills: { ...draft.skills, frameworks: value as string[] } }
    case "skills.tools":
      return { ...draft, skills: { ...draft.skills, tools: value as string[] } }
    case "skills.databases":
      return { ...draft, skills: { ...draft.skills, databases: value as string[] } }
    case "skills.other":
      return { ...draft, skills: { ...draft.skills, other: value as string[] } }
    default:
      return { ...draft, [path]: value } as PortfolioEditorDraft
  }
}

function portfolioReducer(state: State, action: Action): State {
  switch (action.type) {
    case "loaded":
      return {
        ...state,
        draft: { ...cloneData(action.data), templateId: action.templateId ?? "developer" },
        saved: { ...cloneData(action.data), templateId: action.templateId ?? "developer" },
        loading: false,
        hasPortfolio: true,
        existingCv: null,
        generating: false,
        generationStep: -1,
        error: null,
        lastSyncedAt: action.lastSyncedAt ?? null,
        status: action.status ?? "draft",
        slug: action.slug ?? null,
      }
    case "missing":
      return {
        ...state,
        loading: false,
        hasPortfolio: false,
        existingCv: action.existingCv,
        error: null,
      }
    case "load-failed":
      return { ...state, loading: false, error: action.error }
    case "generation-started":
      return { ...state, generating: true, generationStep: 0, error: null }
    case "generation-step":
      return { ...state, generationStep: action.step }
    case "generation-failed":
      return { ...state, generating: false, generationStep: -1, error: action.error }
    case "regenerating-about":
      return { ...state, regeneratingAbout: true, error: null }
    case "about-regenerated": {
      const draft = state.draft.about === action.submittedAbout
        ? { ...state.draft, about: action.about }
        : state.draft
      return {
        ...state,
        draft,
        saved: { ...state.saved, about: action.about },
        regeneratingAbout: false,
        error: null,
      }
    }
    case "regenerate-about-failed":
      return { ...state, regeneratingAbout: false, error: action.error }
    case "saving":
      return { ...state, saving: true, error: null }
    case "saved": {
      const saved = cloneDraft(action.data)
      const draft = JSON.stringify(state.draft) === JSON.stringify(action.submitted)
        ? cloneDraft(action.data)
        : state.draft
      return {
        ...state,
        draft,
        saved,
        saving: false,
        error: null,
        lastSyncedAt: action.lastSyncedAt,
        status: action.status,
        slug: action.slug ?? state.slug,
      }
    }
    case "save-failed":
      return { ...state, saving: false, error: action.error }
    case "sync-started":
      return { ...state, syncing: true, error: null }
    case "sync-completed": {
      const lists = {
        education: action.record.data.education,
        experiences: action.record.data.experiences,
        projects: action.record.data.projects,
        skills: action.record.data.skills,
        certifications: action.record.data.certifications,
      }
      return {
        ...state,
        draft: { ...state.draft, ...lists },
        saved: { ...state.saved, ...lists },
        syncing: false,
        lastSyncedAt: action.record.lastSyncedAt,
        status: action.record.status,
        slug: action.record.slug ?? state.slug,
        error: null,
      }
    }
    case "sync-failed":
      return { ...state, syncing: false, error: action.error }
    case "publish-completed":
    case "unpublish-completed":
      return {
        ...state,
        status: action.record.status,
        slug: action.record.slug ?? state.slug,
        error: null,
      }
    case "reset":
      return { ...state, draft: cloneDraft(state.saved), error: null }
    case "update":
      return {
        ...state,
        draft: applyUpdate(state.draft, action.path, action.value),
        error: null,
      }
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return "Une erreur inattendue est survenue."
}

export function usePortfolio() {
  const [state, dispatch] = useReducer(portfolioReducer, {
    draft: { ...emptyPortfolioData(), templateId: "developer" },
    saved: { ...emptyPortfolioData(), templateId: "developer" },
    loading: true,
    saving: false,
    error: null,
    hasPortfolio: null,
    existingCv: null,
    generating: false,
    generationStep: -1,
    regeneratingAbout: false,
    syncing: false,
    lastSyncedAt: null,
    status: "draft",
    slug: null,
  })
  const isDirty = JSON.stringify(state.draft) !== JSON.stringify(state.saved)

  useEffect(() => {
    if (state.hasPortfolio !== true) return
    localStorage.setItem(PORTFOLIO_PREVIEW_DRAFT_KEY, JSON.stringify(state.draft))
  }, [state.draft, state.hasPortfolio])

  useEffect(() => {
    let active = true
    getMyPortfolio().then(
      (portfolio: PortfolioRecord) => {
        if (active) dispatch({
          type: "loaded",
          data: portfolio.data,
          templateId: portfolio.templateId,
          lastSyncedAt: portfolio.lastSyncedAt,
          status: portfolio.status,
          slug: portfolio.slug,
        })
      },
      (error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 404) {
          cvService.list().then(
            (cvs) => {
              if (active) {
                const existingCv = [...cvs].sort((left, right) =>
                  right.updatedAt.localeCompare(left.updatedAt),
                )[0] ?? null
                dispatch({ type: "missing", existingCv })
              }
            },
            (cvError: unknown) => {
              if (active) dispatch({ type: "load-failed", error: getErrorMessage(cvError) })
            },
          )
          return
        }
        dispatch({ type: "load-failed", error: getErrorMessage(error) })
      },
    )
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [isDirty])

  const update = useCallback(<K extends PortfolioPath>(path: K, value: PortfolioPathValues[K]) => {
    dispatch({ type: "update", path, value } as UpdateAction)
  }, [])

  const save = useCallback(async (): Promise<boolean> => {
    const submitted = cloneDraft(state.draft)
    const { templateId: submittedTemplateId, ...data } = submitted
    dispatch({ type: "saving" })
    try {
      let portfolio = await updatePortfolio(data)
      if (submittedTemplateId !== state.saved.templateId) {
        portfolio = await setTemplate(submittedTemplateId)
      }
      dispatch({
        type: "saved",
        submitted,
        data: { ...portfolio.data, templateId: portfolio.templateId },
        lastSyncedAt: portfolio.lastSyncedAt,
        status: portfolio.status,
        slug: portfolio.slug,
      })
      return true
    } catch (error) {
      dispatch({ type: "save-failed", error: getErrorMessage(error) })
      return false
    }
  }, [state.draft, state.saved.templateId])

  const sync = useCallback(async (): Promise<boolean> => {
    if (isDirty && !(await save())) return false
    dispatch({ type: "sync-started" })
    try {
      const record = await requestSyncPortfolio()
      dispatch({ type: "sync-completed", record })
      return true
    } catch (error) {
      dispatch({ type: "sync-failed", error: getErrorMessage(error) })
      return false
    }
  }, [isDirty, save])

  const publish = useCallback(async (): Promise<boolean> => {
    if (isDirty && !(await save())) return false
    try {
      const record = await requestPublishPortfolio()
      dispatch({ type: "publish-completed", record })
      return true
    } catch (error) {
      dispatch({ type: "save-failed", error: getErrorMessage(error) })
      return false
    }
  }, [isDirty, save])

  const unpublish = useCallback(async (): Promise<boolean> => {
    try {
      const record = await requestUnpublishPortfolio()
      dispatch({ type: "unpublish-completed", record })
      return true
    } catch (error) {
      dispatch({ type: "save-failed", error: getErrorMessage(error) })
      return false
    }
  }, [])

  const generate = useCallback(async (file: File) => {
    dispatch({ type: "generation-started" })
    const steps = [0, 1, 2].map((step) => window.setTimeout(
      () => dispatch({ type: "generation-step", step }),
      step * 12_000,
    ))
    try {
      const portfolio = await generatePortfolio(file)
      dispatch({
        type: "loaded",
        data: portfolio.data,
        templateId: portfolio.templateId,
        lastSyncedAt: portfolio.lastSyncedAt,
        status: portfolio.status,
        slug: portfolio.slug,
      })
    } catch (error) {
      dispatch({ type: "generation-failed", error: getErrorMessage(error) })
    } finally {
      steps.forEach(window.clearTimeout)
    }
  }, [])

  const generateFromExistingCv = useCallback(async () => {
    if (!state.existingCv) {
      dispatch({ type: "generation-failed", error: "Aucun CV enregistré n’est disponible." })
      return
    }
    dispatch({ type: "generation-started" })
    const steps = [0, 1, 2].map((step) => window.setTimeout(
      () => dispatch({ type: "generation-step", step }),
      step * 8_000,
    ))
    try {
      const sourceText = portfolioSourceTextFromCv(state.existingCv)
      if (!sourceText.trim()) throw new Error("Le CV enregistré ne contient aucune information à analyser.")
      const extracted = await extractPortfolioFromCv(sourceText)
      const portfolio = await updatePortfolio(extracted.cleaned)
      dispatch({
        type: "loaded",
        data: portfolio.data,
        templateId: portfolio.templateId,
        lastSyncedAt: portfolio.lastSyncedAt,
        status: portfolio.status,
        slug: portfolio.slug,
      })
    } catch (error) {
      dispatch({ type: "generation-failed", error: getErrorMessage(error) })
    } finally {
      steps.forEach(window.clearTimeout)
    }
  }, [state.existingCv])

  const regenerateAbout = useCallback(async () => {
    const submittedAbout = state.draft.about
    dispatch({ type: "regenerating-about" })
    try {
      const portfolio = await requestRegenerateAbout()
      dispatch({ type: "about-regenerated", about: portfolio.data.about, submittedAbout })
    } catch (error) {
      dispatch({ type: "regenerate-about-failed", error: getErrorMessage(error) })
    }
  }, [state.draft.about])

  const reset = useCallback(() => dispatch({ type: "reset" }), [])

  return {
    draft: state.draft,
    isDirty,
    update,
    save,
    reset,
    loading: state.loading,
    saving: state.saving,
    syncing: state.syncing,
    error: state.error,
    hasPortfolio: state.hasPortfolio,
    existingCv: state.existingCv,
    generating: state.generating,
    generationStep: state.generationStep,
    generate,
    generateFromExistingCv,
    regenerateAbout,
    regeneratingAbout: state.regeneratingAbout,
    lastSyncedAt: state.lastSyncedAt,
    status: state.status,
    slug: state.slug,
    sync,
    publish,
    unpublish,
  }
}
