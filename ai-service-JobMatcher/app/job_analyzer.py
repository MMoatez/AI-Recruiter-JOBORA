"""Job requirement analysis.

Structured fields supplied by the NestJS backend are authoritative; the
provider extracts additional requirements from the free-text description, and
deterministic parsing (skills dictionary, year patterns, arrangement keywords)
acts as a grounded floor. Nothing is invented when the posting is silent.
"""

from __future__ import annotations

import json
import re

from .config import Settings
from .profile_extractor import detect_skills, merge_skills
from .prompts import JOB_SYSTEM, job_user_payload
from .providers.base import Provider
from .schemas import (
    BatchJobAnalysisModelOutput,
    JobAnalysisModelOutput,
    JobInput,
    JobRequirements,
    Seniority,
    WorkArrangement,
)

_BATCH_SIZE = 8

_ARRANGEMENT_KEYWORDS: list[tuple[WorkArrangement, tuple[str, ...]]] = [
    (WorkArrangement.remote, ("remote", "télétravail", "teletravail", "full remote")),
    (WorkArrangement.hybrid, ("hybride", "hybrid")),
    (WorkArrangement.onsite, ("sur site", "on-site", "onsite", "présentiel", "presentiel")),
]

_SENIORITY_KEYWORDS: list[tuple[Seniority, tuple[str, ...]]] = [
    (Seniority.junior, ("junior", "débutant", "debutant", "starter", "0-2 ans", "1-3 ans")),
    (Seniority.mid, ("confirmé", "confirme", "mid-level", "intermédiaire", "intermediaire", "3-5 ans")),
    (Seniority.senior, ("senior", "sénior", "lead", "expert", "architecte", "5+ ans", "8-10 ans")),
]


def _to_seniority(value: str | None) -> Seniority:
    if not value:
        return Seniority.unknown
    try:
        return Seniority(value.strip().lower())
    except ValueError:
        return Seniority.unknown


def _to_arrangement(value: str | None) -> WorkArrangement:
    if not value:
        return WorkArrangement.unknown
    try:
        return WorkArrangement(value.strip().lower())
    except ValueError:
        return WorkArrangement.unknown


def deterministic_requirements(job: JobInput) -> JobRequirements:
    """Grounded baseline extracted from structured fields and the description."""
    text = f"{job.title}\n{job.description}"
    required = merge_skills(job.required_skills, detect_skills(job.description))
    preferred = merge_skills(job.preferred_skills)

    min_years = job.min_experience_years
    if min_years is None:
        for pattern in (
            re.compile(r"(\d+)\s*\+?\s*(?:years?|yrs?|ans?)\s+(?:d'expérience|of experience|experience)", re.IGNORECASE),
            re.compile(r"(\d+)\+?\s*(?:years?|yrs?)\b", re.IGNORECASE),
        ):
            match = pattern.search(job.description)
            if match:
                min_years = float(match.group(1))
                break

    seniority = job.seniority if job.seniority is not None else Seniority.unknown
    if seniority is Seniority.unknown:
        lowered = text.lower()
        for level, keywords in _SENIORITY_KEYWORDS:
            if any(keyword in lowered for keyword in keywords):
                seniority = level
                break

    arrangement = job.work_arrangement if job.work_arrangement is not None else WorkArrangement.unknown
    if arrangement is WorkArrangement.unknown:
        lowered = job.description.lower()
        for known, keywords in _ARRANGEMENT_KEYWORDS:
            if any(keyword in lowered for keyword in keywords):
                arrangement = known
                break

    return JobRequirements(
        required_skills=required,
        preferred_skills=preferred,
        min_experience_years=min_years,
        seniority=seniority,
        responsibilities=[],
        education_requirements=job.education_requirement,
        location=job.location,
        work_arrangement=arrangement,
        languages=[],
    )


def _merge_model(base: JobRequirements, model: JobAnalysisModelOutput) -> JobRequirements:
    """Provider output may add requirements; structured backend fields win."""
    required = merge_skills(base.required_skills, model.required_skills)
    preferred = merge_skills(
        [s for s in base.preferred_skills if s not in required],
        [s for s in model.preferred_skills if s not in required],
    )
    seniority = base.seniority if base.seniority is not Seniority.unknown else _to_seniority(model.seniority)
    arrangement = (
        base.work_arrangement
        if base.work_arrangement is not WorkArrangement.unknown
        else _to_arrangement(model.work_arrangement)
    )
    return JobRequirements(
        required_skills=required,
        preferred_skills=preferred,
        min_experience_years=(
            base.min_experience_years if base.min_experience_years is not None else model.min_experience_years
        ),
        seniority=seniority,
        responsibilities=[r.strip() for r in model.responsibilities if r.strip()][:25],
        education_requirements=base.education_requirements or model.education_requirements.strip(),
        location=base.location or model.location.strip(),
        work_arrangement=arrangement,
        languages=merge_skills(base.languages, model.languages, limit=20),
    )


def analyze_jobs(jobs: list[JobInput], provider: Provider, settings: Settings) -> dict[str, JobRequirements]:
    """Analyze jobs in bounded batches, returning requirements keyed by job_id."""
    requirements: dict[str, JobRequirements] = {}
    for start in range(0, len(jobs), _BATCH_SIZE):
        batch = jobs[start : start + _BATCH_SIZE]
        output = provider.complete_json(JOB_SYSTEM, job_user_payload(batch), BatchJobAnalysisModelOutput)
        if len(output.jobs) != len(batch):
            raise ValueError("provider returned a batch with an unexpected number of entries")
        for job, model in zip(batch, output.jobs, strict=True):
            requirements[job.job_id] = _merge_model(deterministic_requirements(job), model)
    return requirements


def analyze_job(job: JobInput, provider: Provider, settings: Settings) -> JobRequirements:
    return analyze_jobs([job], provider, settings)[job.job_id]


def requirements_summary(requirements: JobRequirements) -> dict:
    """JSON-safe view used in semantic prompts."""
    return {
        "required_skills": requirements.required_skills,
        "preferred_skills": requirements.preferred_skills,
        "min_experience_years": requirements.min_experience_years,
        "seniority": requirements.seniority.value,
        "responsibilities": requirements.responsibilities,
        "education_requirements": requirements.education_requirements,
        "location": requirements.location,
        "work_arrangement": requirements.work_arrangement.value,
        "languages": requirements.languages,
    }


def dump_requirements(requirements: JobRequirements) -> str:
    return json.dumps(requirements_summary(requirements), ensure_ascii=False)
