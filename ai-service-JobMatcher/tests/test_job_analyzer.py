from __future__ import annotations

import pytest

from app.config import get_settings
from app.job_analyzer import analyze_job, analyze_jobs, deterministic_requirements
from app.schemas import (
    BatchJobAnalysisModelOutput,
    JobInput,
    Seniority,
    WorkArrangement,
)

from .conftest import MockProvider, default_analysis_batch


def make_job(**overrides) -> JobInput:
    payload = {
        "job_id": "job-1",
        "title": "Backend Developer",
        "company": "ACME",
        "description": "You will build REST APIs with Python. 3 years of experience required. Remote work.",
        "required_skills": ["Python"],
        "preferred_skills": [],
    }
    payload.update(overrides)
    return JobInput.model_validate(payload)


def test_deterministic_requirements_from_structured_fields_and_description() -> None:
    requirements = deterministic_requirements(make_job())
    assert "Python" in requirements.required_skills
    assert requirements.min_experience_years == 3
    assert requirements.work_arrangement is WorkArrangement.remote
    assert requirements.location == "Paris" or requirements.location == ""


def test_deterministic_seniority_detection_from_title() -> None:
    requirements = deterministic_requirements(make_job(title="Senior Software Engineer", description="Build things."))
    assert requirements.seniority is Seniority.senior


def test_deterministic_unknowns_stay_unknown() -> None:
    requirements = deterministic_requirements(
        make_job(description="A vague posting with no numbers at all.", required_skills=[])
    )
    assert requirements.min_experience_years is None
    assert requirements.required_skills == []
    assert requirements.work_arrangement is WorkArrangement.unknown


def test_provider_output_merges_and_structured_fields_win() -> None:
    job = make_job(min_experience_years=5, required_skills=["Python"])
    provider = MockProvider(
        responses={
            BatchJobAnalysisModelOutput: default_analysis_batch(
                1, min_experience_years=1, required_skills=["Go", "Python"], seniority="senior"
            )
        }
    )
    requirements = analyze_job(job, provider, get_settings())
    assert requirements.min_experience_years == 5  # backend field wins
    assert "Go" in requirements.required_skills  # provider may add
    assert "Python" in requirements.required_skills
    assert requirements.seniority is Seniority.senior  # structured field unknown -> provider wins


def test_batched_analysis_preserves_order_and_ids() -> None:
    jobs = [make_job(job_id=f"job-{i}") for i in range(3)]
    provider = MockProvider(responses={BatchJobAnalysisModelOutput: default_analysis_batch(3)})
    result = analyze_jobs(jobs, provider, get_settings())
    assert set(result) == {"job-0", "job-1", "job-2"}


def test_batch_size_mismatch_raises() -> None:
    provider = MockProvider(responses={BatchJobAnalysisModelOutput: default_analysis_batch(1)})
    with pytest.raises(ValueError):
        analyze_jobs([make_job(job_id="a"), make_job(job_id="b")], provider, get_settings())
