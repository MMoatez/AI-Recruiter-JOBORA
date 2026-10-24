from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator


SafeText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Identifier = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$")]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorDetail(StrictModel):
    code: str
    message: str
    request_id: str
    fields: dict[str, str] | None = None


class ErrorResponse(StrictModel):
    error: ErrorDetail


class HealthResponse(StrictModel):
    status: Literal["ok", "degraded"]
    database: Literal["available", "unavailable"]
    version: str


class AIStatusResponse(StrictModel):
    available: bool
    provider: Literal["groq"] = "groq"
    configured: bool
    configured_model: str | None
    live_check_performed: bool
    message: str


class EmbeddingStatusResponse(StrictModel):
    active_source: Literal["baseline", "fine_tuned", "baseline_fallback"]
    active_model: str
    baseline_model: str
    fine_tuned_enabled: bool
    fallback_reason: str | None


class DocumentExtractionResponse(StrictModel):
    filename: str
    text: str
    character_count: int
    truncated: bool


class CandidateSkillInput(StrictModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    level: Literal["beginner", "intermediate", "advanced", "unknown"] = "unknown"
    evidence: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]] = Field(
        default_factory=list, max_length=10
    )


class TrainingAnalyzeRequest(StrictModel):
    user_reference: Identifier = "development-user"
    candidate_skills: list[CandidateSkillInput] = Field(default_factory=list, max_length=100)
    sanitized_cv_text: Annotated[str, StringConstraints(strip_whitespace=True, max_length=20000)] | None = None
    job_description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=30000)]
    career_goal: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=500)]
    current_level: Literal["beginner", "intermediate", "advanced"]
    weekly_hours: int = Field(ge=1, le=40)
    target_weeks: int = Field(ge=1, le=52)
    preferred_language: Literal["fr", "en"] = "fr"
    free_only: bool = True

    @model_validator(mode="after")
    def candidate_information_is_present(self) -> "TrainingAnalyzeRequest":
        if not self.candidate_skills and not self.sanitized_cv_text:
            raise ValueError("Provide candidate_skills or sanitized_cv_text")
        return self


class SkillGap(StrictModel):
    skill: str
    requirement_excerpt: str
    importance: Literal["required", "preferred", "bonus"]
    status: Literal["matched", "partial", "weakly_evidenced", "missing"]
    similarity: float = Field(ge=0, le=1)
    priority: int = Field(ge=1, le=100)
    matched_candidate_skill: str | None = None
    evidence: list[str] = Field(default_factory=list)
    reasoning: str


class RoadmapTask(StrictModel):
    id: Identifier
    title: Annotated[str, StringConstraints(min_length=2, max_length=160)]
    objective: Annotated[str, StringConstraints(min_length=5, max_length=500)]
    estimated_hours: float = Field(gt=0, le=40)
    exercise: Annotated[str, StringConstraints(min_length=5, max_length=1000)]
    deliverables: list[Annotated[str, StringConstraints(min_length=2, max_length=300)]] = Field(min_length=1, max_length=8)
    evaluation_criteria: list[Annotated[str, StringConstraints(min_length=2, max_length=300)]] = Field(
        min_length=1, max_length=8
    )


class RoadmapWeek(StrictModel):
    week: int = Field(ge=1, le=52)
    title: Annotated[str, StringConstraints(min_length=2, max_length=160)]
    skills: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(min_length=1, max_length=10)
    tasks: list[RoadmapTask] = Field(min_length=1, max_length=10)


class PortfolioProject(StrictModel):
    title: Annotated[str, StringConstraints(min_length=2, max_length=160)]
    description: Annotated[str, StringConstraints(min_length=10, max_length=1000)]
    skills: list[str] = Field(min_length=1, max_length=10)
    deliverables: list[str] = Field(min_length=1, max_length=10)
    evaluation_criteria: list[str] = Field(min_length=1, max_length=10)


class GeneratedRoadmap(StrictModel):
    title: Annotated[str, StringConstraints(min_length=2, max_length=160)]
    summary: Annotated[str, StringConstraints(min_length=10, max_length=1000)]
    weeks: list[RoadmapWeek] = Field(min_length=1, max_length=52)
    projects: list[PortfolioProject] = Field(min_length=1, max_length=5)


class GeneratedRoadmapPlan(StrictModel):
    title: Annotated[str, StringConstraints(min_length=2, max_length=160)]
    summary: Annotated[str, StringConstraints(min_length=10, max_length=1000)]
    weeks: list[RoadmapWeek] = Field(min_length=1, max_length=52)


class GeneratedPortfolioProjects(StrictModel):
    projects: list[PortfolioProject] = Field(min_length=1, max_length=5)


class AIProvenance(StrictModel):
    provider: Literal["groq", "google_gemini"] = "groq"
    model: str
    live_generation: Literal[True] = True


class LearningResource(StrictModel):
    id: Identifier
    title: Annotated[str, StringConstraints(min_length=2, max_length=200)]
    provider: Annotated[str, StringConstraints(min_length=2, max_length=120)]
    url: Annotated[str, StringConstraints(pattern=r"^https://", max_length=500)]
    skills: list[Annotated[str, StringConstraints(min_length=1, max_length=100)]] = Field(min_length=1, max_length=20)
    category: Literal["course", "documentation", "certification", "tutorial"]
    level: Literal["beginner", "intermediate", "advanced", "all"]
    languages: list[Literal["fr", "en"]] = Field(min_length=1, max_length=2)
    access: Literal["free", "paid"]
    estimated_hours: float | None = Field(default=None, gt=0, le=1000)
    verification_status: Literal["verified", "unverified"]
    verified_at: date | None = None

    @model_validator(mode="after")
    def verification_date_is_consistent(self) -> "LearningResource":
        if self.verification_status == "verified" and self.verified_at is None:
            raise ValueError("Verified resources require verified_at")
        if self.verification_status == "unverified" and self.verified_at is not None:
            raise ValueError("Unverified resources cannot have verified_at")
        return self


class TrainingAnalysisResponse(StrictModel):
    plan_id: str
    gaps: list[SkillGap]
    roadmap: GeneratedRoadmap
    resources: list[LearningResource]
    provenance: AIProvenance
    created_at: datetime


class PlanCreateRequest(StrictModel):
    # This is an untrusted development reference, not an authenticated identity.
    user_reference: Identifier = "development-user"
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
    career_goal: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=500)]
    weekly_hours: int = Field(ge=1, le=80)
    target_weeks: int = Field(ge=1, le=104)
    preferred_language: Literal["fr", "en"] = "fr"
    free_only: bool = True


class TaskProgressUpdate(StrictModel):
    status: Literal["not_started", "in_progress", "completed"]
    completion_percent: int = Field(ge=0, le=100)
    minutes_spent: int = Field(default=0, ge=0, le=100000)
    evidence_note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=1000)] | None = None

    @model_validator(mode="after")
    def status_matches_percent(self) -> "TaskProgressUpdate":
        if self.status == "completed" and self.completion_percent != 100:
            raise ValueError("A completed task must have 100 percent completion")
        if self.status == "not_started" and self.completion_percent != 0:
            raise ValueError("A not-started task must have zero percent completion")
        return self

    @field_validator("evidence_note")
    @classmethod
    def empty_evidence_is_none(cls, value: str | None) -> str | None:
        return value or None


class TaskProgressResponse(StrictModel):
    task_id: str
    status: Literal["not_started", "in_progress", "completed"]
    completion_percent: int
    minutes_spent: int
    evidence_note: str | None
    updated_at: datetime


class LearningPlanResponse(StrictModel):
    id: str
    user_reference: str
    title: str
    career_goal: str
    weekly_hours: int
    target_weeks: int
    preferred_language: Literal["fr", "en"]
    free_only: bool
    status: Literal["draft", "generating", "ready", "failed"]
    provenance: Literal["manual", "live_ai"]
    model_name: str | None
    content: dict[str, object]
    progress: list[TaskProgressResponse]
    created_at: datetime
    updated_at: datetime


class AssessmentCreateRequest(StrictModel):
    plan_id: Identifier | None = None
    user_reference: Identifier = "development-user"
    skill: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]


class AssessmentQuestionPublic(StrictModel):
    id: Identifier
    concept_id: Identifier
    prompt: str
    choices: list[str]
    difficulty: Literal["beginner", "intermediate", "advanced"]


class AssessmentSessionResponse(StrictModel):
    id: Identifier
    skill: str
    status: Literal["active", "submitted"]
    questions: list[AssessmentQuestionPublic]
    created_at: datetime


class AssessmentAnswerInput(StrictModel):
    question_id: Identifier
    selected_choice: int = Field(ge=0, le=9)


class AssessmentSubmitRequest(StrictModel):
    user_reference: Identifier = "development-user"
    answers: list[AssessmentAnswerInput] = Field(min_length=1, max_length=30)

    @field_validator("answers")
    @classmethod
    def unique_questions(cls, answers: list[AssessmentAnswerInput]) -> list[AssessmentAnswerInput]:
        if len({answer.question_id for answer in answers}) != len(answers):
            raise ValueError("Each question may be answered only once")
        return answers


class AssessmentAnswerResult(StrictModel):
    question_id: Identifier
    concept_id: Identifier
    selected_choice: int
    correct_choice: int
    correct: bool
    explanation: str
    observation_posterior: float
    mastery: float


class AssessmentResultResponse(StrictModel):
    session_id: Identifier
    score: int
    total: int
    results: list[AssessmentAnswerResult]
    submitted_at: datetime


class MasteryPoint(StrictModel):
    concept_id: Identifier
    skill: str
    mastery: float
    observation_posterior: float
    correct: bool
    parameter_version: str
    recorded_at: datetime


class AdaptiveRecommendation(StrictModel):
    concept_id: Identifier
    skill: str
    mastery: float
    action: Literal["foundational_review", "targeted_practice", "advanced_tasks"]
    rationale: str
    disclaimer: str = "Estimation probabiliste BKT, pas une preuve de compétence professionnelle."


class QuestionGenerationRequest(StrictModel):
    skill: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    concept_id: Identifier
    difficulty: Literal["beginner", "intermediate", "advanced"] = "beginner"


class GeneratedQuestionKey(StrictModel):
    prompt: Annotated[str, StringConstraints(min_length=10, max_length=500)]
    choices: list[Annotated[str, StringConstraints(min_length=1, max_length=300)]] = Field(min_length=3, max_length=6)
    correct_choice: int = Field(ge=0, le=5)
    explanation: Annotated[str, StringConstraints(min_length=10, max_length=800)]

    @model_validator(mode="after")
    def valid_key(self) -> "GeneratedQuestionKey":
        if self.correct_choice >= len(self.choices) or len(set(self.choices)) != len(self.choices):
            raise ValueError("Choices must be unique and the key must reference one choice")
        return self


class PendingQuestionResponse(StrictModel):
    id: Identifier
    concept_id: Identifier
    skill: str
    prompt: str
    choices: list[str]
    difficulty: Literal["beginner", "intermediate", "advanced"]
    review_status: Literal["pending_review"] = "pending_review"
