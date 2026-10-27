from __future__ import annotations

import pytest

from app.config import get_settings
from app.matching_engine import (
    deterministic_gaps,
    deterministic_reasons,
    eligibility_reason,
    experience_ratio,
    score_job,
    seniority_ratio,
    skill_coverage,
)
from app.schemas import CandidateProfile, JobRequirements, Seniority, WorkArrangement


def profile(**overrides) -> CandidateProfile:
    payload = {
        "skills": ["Python", "FastAPI"],
        "experience_years": 2,
        "seniority": Seniority.junior,
        "job_titles": ["Developer"],
        "languages": ["French"],
        "education": ["Software Engineering"],
        "certifications": [],
        "preferred_locations": [],
        "work_preferences": [],
    }
    payload.update(overrides)
    return CandidateProfile.model_validate(payload)


def requirements(**overrides) -> JobRequirements:
    payload = {
        "required_skills": ["Python", "Kubernetes"],
        "preferred_skills": ["Docker"],
        "min_experience_years": 2,
        "seniority": Seniority.junior,
        "responsibilities": [],
        "education_requirements": "",
        "location": "Paris",
        "work_arrangement": WorkArrangement.hybrid,
        "languages": [],
    }
    payload.update(overrides)
    if payload.get("seniority") is None:
        payload["seniority"] = Seniority.unknown
    return JobRequirements.model_validate(payload)


def test_skill_coverage_counts_matched_and_missing_case_insensitively() -> None:
    ratio, matched, missing = skill_coverage(["python", "DOCKER"], ["Python", "Kubernetes", "Docker"])
    assert ratio == pytest.approx(2 / 3)
    assert set(matched) == {"Python", "Docker"}
    assert missing == ["Kubernetes"]


def test_skill_coverage_unknown_when_target_empty() -> None:
    ratio, matched, missing = skill_coverage(["Python"], [])
    assert ratio is None
    assert matched == [] and missing == []


def test_unknown_signals_excluded_from_denominator(monkeypatch) -> None:
    """With experience unknown, the score uses only known components' weights."""
    monkeypatch.delenv("JOB_MATCHER_WEIGHT_EXPERIENCE", raising=False)
    req = requirements(required_skills=["Python"], preferred_skills=[], min_experience_years=None, seniority=None)
    scored = score_job(profile(experience_years=None, seniority=Seniority.unknown), req, get_settings())
    # required_skills fully covered -> score 100 even though other components unknown
    assert scored.score == 100
    assert scored.breakdown["experience"] is None
    assert scored.breakdown["seniority"] is None
    assert scored.breakdown["semantic_fit"] is None
    assert scored.breakdown["preferred_skills"] is None


def test_partial_skill_coverage_produces_intermediate_score(monkeypatch) -> None:
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_PREFERRED_SKILLS", "0")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_EXPERIENCE", "0")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_SENIORITY", "0")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_SEMANTIC_FIT", "0")
    req = requirements(required_skills=["Python", "Kubernetes", "Go", "Rust"])
    scored = score_job(profile(), req, get_settings())
    assert scored.score == 25  # 1 of 4 required skills, only known component


def test_custom_weights_change_the_score(monkeypatch) -> None:
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_REQUIRED_SKILLS", "1")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_PREFERRED_SKILLS", "0")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_EXPERIENCE", "0")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_SENIORITY", "0")
    monkeypatch.setenv("JOB_MATCHER_WEIGHT_SEMANTIC_FIT", "0")
    req = requirements(required_skills=["Python", "Kubernetes"], preferred_skills=["Docker"], min_experience_years=None, seniority=None)
    scored = score_job(profile(), req, get_settings())
    assert scored.score == 50


def test_experience_tolerance_and_deficit() -> None:
    assert experience_ratio(2, 2, 1) == 1.0
    assert experience_ratio(1.5, 2, 1) == 1.0  # deficit within 1-year tolerance
    assert experience_ratio(1, 4, 0) is not None and experience_ratio(1, 4, 0) < 0.5
    assert experience_ratio(None, 2, 1) is None
    assert experience_ratio(3, None, 1) is None
    assert experience_ratio(0, 0, 1) == 1.0


def test_seniority_alignment() -> None:
    assert seniority_ratio(Seniority.senior, Seniority.junior) == 1.0
    assert seniority_ratio(Seniority.junior, Seniority.junior) == 1.0
    assert seniority_ratio(Seniority.junior, Seniority.senior) == 0.1
    assert seniority_ratio(Seniority.junior, Seniority.mid) == 0.5
    assert seniority_ratio(Seniority.unknown, Seniority.senior) is None


def test_eligibility_filters_clear_experience_deficit_only() -> None:
    settings = get_settings()
    # deficit larger than tolerance -> excluded
    assert (
        eligibility_reason(profile(experience_years=1), requirements(min_experience_years=5), settings)
        == "insufficient_experience"
    )
    # unknown candidate experience is NOT an exclusion
    assert eligibility_reason(profile(experience_years=None), requirements(min_experience_years=5), settings) is None
    # within tolerance stays eligible
    assert eligibility_reason(profile(experience_years=4), requirements(min_experience_years=5), settings) is None


def test_score_none_when_no_known_components() -> None:
    scored = score_job(
        profile(experience_years=None, seniority=Seniority.unknown),
        requirements(
            required_skills=[],
            preferred_skills=[],
            min_experience_years=None,
            seniority=None,
        ),
        get_settings(),
    )
    assert scored.score is None


def test_reasons_and_gaps_are_grounded_in_evidence() -> None:
    settings = get_settings()
    req = requirements(required_skills=["Python", "Kubernetes"], min_experience_years=5)
    scored = score_job(profile(experience_years=2), req, settings)
    reasons = deterministic_reasons(profile(experience_years=2), req, scored, settings)
    gaps = deterministic_gaps(profile(experience_years=2), req, scored, settings)
    assert any("Kubernetes" in reason or "compétences requises" in reason for reason in reasons)
    assert any("Kubernetes" in gap for gap in gaps)
    assert not any("manager" in gap.lower() for gap in gaps)


def test_no_protected_characteristic_language_in_reasons() -> None:
    settings = get_settings()
    req = requirements()
    scored = score_job(profile(), req, settings)
    reasons = " ".join(deterministic_reasons(profile(), req, scored, settings)).lower()
    for banned in ("âge", "age", "sexe", "genre", "religion", "handicap", "ethnic", "marié"):
        assert banned not in reasons
