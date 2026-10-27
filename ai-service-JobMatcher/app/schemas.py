"""Pydantic contracts for every request and response of the Job Matcher service."""

from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class Seniority(str, Enum):
    junior = "junior"
    mid = "mid"
    senior = "senior"
    unknown = "unknown"


class WorkArrangement(str, Enum):
    remote = "remote"
    hybrid = "hybrid"
    onsite = "onsite"
    unknown = "unknown"


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


Skill = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]


class CandidateProfile(StrictModel):
    """Structured, evidence-based view of a candidate extracted from a CV."""

    skills: list[Skill] = Field(default_factory=list, max_length=150)
    experience_years: float | None = Field(default=None, ge=0, le=60)
    seniority: Seniority = Seniority.unknown
    job_titles: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]] = Field(
        default_factory=list, max_length=30
    )
    languages: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]] = Field(
        default_factory=list, max_length=20
    )
    education: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]] = Field(
        default_factory=list, max_length=30
    )
    certifications: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]] = Field(
        default_factory=list, max_length=30
    )
    preferred_locations: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]] = Field(
        default_factory=list, max_length=20
    )
    work_preferences: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]] = Field(
        default_factory=list, max_length=20
    )


class JobInput(StrictModel):
    """A complete job record supplied by the trusted NestJS backend."""

    job_id: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    company: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=30000)] = ""
    required_skills: list[Skill] = Field(default_factory=list, max_length=60)
    preferred_skills: list[Skill] = Field(default_factory=list, max_length=60)
    seniority: Seniority | None = None
    min_experience_years: float | None = Field(default=None, ge=0, le=60)
    education_requirement: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    work_arrangement: WorkArrangement | None = None
    contract_type: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""


class JobRequirements(StrictModel):
    """Structured requirements extracted from a job posting."""

    required_skills: list[Skill] = Field(default_factory=list, max_length=60)
    preferred_skills: list[Skill] = Field(default_factory=list, max_length=60)
    min_experience_years: float | None = Field(default=None, ge=0, le=60)
    seniority: Seniority = Seniority.unknown
    responsibilities: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)]] = Field(
        default_factory=list, max_length=25
    )
    education_requirements: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    work_arrangement: WorkArrangement = WorkArrangement.unknown
    languages: list[Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)]] = Field(
        default_factory=list, max_length=20
    )


class AnalyzeJobRequest(StrictModel):
    job: JobInput


class AnalyzeJobResponse(StrictModel):
    requirements: JobRequirements


class ParseCvResponse(StrictModel):
    profile: CandidateProfile
    extracted_text_length: int = Field(ge=0)
    redacted: bool = True


class MatchOptions(StrictModel):
    top_n: int = Field(default=10, ge=1, le=50)
    explain_top_n: int | None = Field(default=None, ge=1, le=50)


class MatchRequest(StrictModel):
    profile: CandidateProfile
    jobs: list[JobInput] = Field(min_length=1)
    options: MatchOptions = Field(default_factory=MatchOptions)


class ScoreBreakdown(StrictModel):
    """Per-component contributions, only for components with known inputs."""

    required_skills: float | None = None
    preferred_skills: float | None = None
    experience: float | None = None
    seniority: float | None = None
    semantic_fit: float | None = None
    applicable_weight_total: float = Field(ge=0)


class MatchResult(StrictModel):
    job_id: str
    job_title: str
    company: str = ""
    location: str = ""
    work_arrangement: WorkArrangement = WorkArrangement.unknown
    compatibility_score: int = Field(ge=0, le=100)
    matched_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    missing_preferred_skills: list[str] = Field(default_factory=list)
    semantic_fit: float | None = Field(default=None, ge=0, le=1)
    reasons: list[str] = Field(default_factory=list, max_length=8)
    recommendations: list[str] = Field(default_factory=list, max_length=6)
    gaps: list[str] = Field(default_factory=list, max_length=8)
    score_breakdown: ScoreBreakdown


class ExcludedJob(StrictModel):
    job_id: str
    reason: str


class MatchResponse(StrictModel):
    results: list[MatchResult]
    total_jobs_analyzed: int = Field(ge=0)
    total_jobs_eligible: int = Field(ge=0)
    excluded_jobs: list[ExcludedJob] = Field(default_factory=list, max_length=200)
    weights: dict[str, float]
    algorithm: str


# --- Provider-facing model outputs (validated on every Groq response) ---


class ProfileModelOutput(StrictModel):
    model_config = ConfigDict(extra="forbid")

    skills: list[str] = Field(default_factory=list, max_length=150)
    experience_years: float | None = Field(default=None, ge=0, le=60)
    seniority: str = "unknown"
    job_titles: list[str] = Field(default_factory=list, max_length=30)
    languages: list[str] = Field(default_factory=list, max_length=20)
    education: list[str] = Field(default_factory=list, max_length=30)
    certifications: list[str] = Field(default_factory=list, max_length=30)
    preferred_locations: list[str] = Field(default_factory=list, max_length=20)
    work_preferences: list[str] = Field(default_factory=list, max_length=20)


class JobAnalysisModelOutput(StrictModel):
    model_config = ConfigDict(extra="forbid")

    required_skills: list[str] = Field(default_factory=list, max_length=60)
    preferred_skills: list[str] = Field(default_factory=list, max_length=60)
    min_experience_years: float | None = Field(default=None, ge=0, le=60)
    seniority: str = "unknown"
    responsibilities: list[str] = Field(default_factory=list, max_length=25)
    education_requirements: str = ""
    location: str = ""
    work_arrangement: str = "unknown"
    languages: list[str] = Field(default_factory=list, max_length=20)


class BatchJobAnalysisModelOutput(StrictModel):
    model_config = ConfigDict(extra="forbid")

    jobs: list[JobAnalysisModelOutput] = Field(min_length=1, max_length=20)


class SemanticMatchModelOutput(StrictModel):
    model_config = ConfigDict(extra="forbid")

    job_id: str
    semantic_fit: float = Field(ge=0, le=1)
    reasons: list[str] = Field(default_factory=list, max_length=6)
    recommendations: list[str] = Field(default_factory=list, max_length=4)


class SemanticBatchModelOutput(StrictModel):
    model_config = ConfigDict(extra="forbid")

    matches: list[SemanticMatchModelOutput] = Field(min_length=1, max_length=20)
