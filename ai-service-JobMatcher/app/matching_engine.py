"""Deterministic eligibility rules and weighted compatibility scoring.

Scoring rules:
- every signal is a ratio in [0, 1] or None when its inputs are unknown;
- the final score is 100 * sum(weight * ratio) / sum(weight) over the
  components whose inputs are KNOWN - unknown signals are excluded from the
  denominator instead of counting as mismatches;
- weights come from settings (JOB_MATCHER_WEIGHT_*) and are renormalized;
- a job with no known component at all cannot be scored and is reported as
  unscored rather than ranked with a made-up value;
- protected characteristics (age, gender, ethnicity, religion, disability...)
  are never inputs to eligibility or scoring.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from .config import Settings
from .schemas import CandidateProfile, JobRequirements, Seniority

_LEVELS = {Seniority.junior: 1, Seniority.mid: 2, Seniority.senior: 3}

YEAR_PATTERNS = [
    re.compile(r"(\d+(?:[.,]\d+)?)\s*\+?\s*(?:years?|yrs?|ans?)\b", re.IGNORECASE),
]


@dataclass
class ScoredJob:
    score: int | None
    breakdown: dict[str, float | None] = field(default_factory=dict)
    applicable_weight_total: float = 0.0
    matched_skills: list[str] = field(default_factory=list)
    missing_required: list[str] = field(default_factory=list)
    missing_preferred: list[str] = field(default_factory=list)


def skill_coverage(candidate_skills: list[str], target_skills: list[str]) -> tuple[float | None, list[str], list[str]]:
    """Return (coverage, matched, missing). None when the target is empty/unknown."""
    if not target_skills:
        return None, [], []
    candidate_keys = {_key(s) for s in candidate_skills}
    unique_targets: list[str] = []
    seen: set[str] = set()
    for skill in target_skills:
        key = _key(skill)
        if not key or key in seen:
            continue
        seen.add(key)
        unique_targets.append(skill)
    if not unique_targets:
        return None, [], []
    matched = [s for s in unique_targets if _key(s) in candidate_keys]
    missing = [s for s in unique_targets if _key(s) not in candidate_keys]
    return len(matched) / len(unique_targets), matched, missing


def _key(skill: str) -> str:
    return re.sub(r"[\s./#-]+", "", skill.lower())


def experience_ratio(candidate_years: float | None, required_years: float | None, tolerance: float) -> float | None:
    """Alignment of candidate experience with the requirement.

    Unknown on either side -> None. A deficit within the tolerance (default 1
    year) still counts as a full match; larger deficits decay linearly.
    """
    if candidate_years is None or required_years is None:
        return None
    if required_years <= 0:
        return 1.0
    effective = max(required_years - tolerance, 0.5)
    if candidate_years >= effective:
        return 1.0
    return max(0.0, candidate_years / effective)


def seniority_ratio(candidate: Seniority, required: Seniority | None) -> float | None:
    if required is None or required is Seniority.unknown or candidate is Seniority.unknown:
        return None
    gap = _LEVELS[required] - _LEVELS[candidate]
    if gap <= 0:
        return 1.0
    if gap == 1:
        return 0.5
    return 0.1


def eligibility_reason(profile: CandidateProfile, requirements: JobRequirements, settings: Settings) -> str | None:
    """Transparent exclusion rules. Returns a machine-readable reason or None."""
    required_years = requirements.min_experience_years
    if (
        required_years is not None
        and profile.experience_years is not None
        and profile.experience_years + settings.experience_tolerance_years < required_years
    ):
        return "insufficient_experience"
    return None


def score_job(
    profile: CandidateProfile,
    requirements: JobRequirements,
    settings: Settings,
    semantic_fit: float | None = None,
) -> ScoredJob:
    weights = settings.normalized_weights
    required_ratio, matched, missing_required = skill_coverage(profile.skills, requirements.required_skills)
    preferred_ratio, _, missing_preferred = skill_coverage(profile.skills, requirements.preferred_skills)
    exp_ratio = experience_ratio(
        profile.experience_years, requirements.min_experience_years, settings.experience_tolerance_years
    )
    sen_ratio = seniority_ratio(profile.seniority, requirements.seniority)

    components: dict[str, float | None] = {
        "required_skills": required_ratio,
        "preferred_skills": preferred_ratio,
        "experience": exp_ratio,
        "seniority": sen_ratio,
        "semantic_fit": semantic_fit if semantic_fit is not None else None,
    }

    applicable = {name: ratio for name, ratio in components.items() if ratio is not None}
    weight_total = sum(weights[name] for name in applicable)
    if weight_total <= 0:
        score = None
    else:
        weighted = sum(weights[name] * ratio for name, ratio in applicable.items())
        score = int(round(100 * weighted / weight_total))
    breakdown: dict[str, float | None] = {
        name: (round(applicable[name], 4) if name in applicable else None) for name in components
    }

    return ScoredJob(
        score=score,
        breakdown={**breakdown, "applicable_weight_total": round(weight_total, 4)},
        applicable_weight_total=round(weight_total, 4),
        matched_skills=matched,
        missing_required=missing_required,
        missing_preferred=missing_preferred,
    )


_SENIORITY_LABELS = {
    Seniority.junior: "junior",
    Seniority.mid: "confirmé",
    Seniority.senior: "senior",
    Seniority.unknown: "non précisé",
}


def deterministic_reasons(
    profile: CandidateProfile, requirements: JobRequirements, scored: ScoredJob, settings: Settings
) -> list[str]:
    """Grounded French explanations built only from computed evidence."""
    reasons: list[str] = []
    if requirements.required_skills and (scored.matched_skills or scored.missing_required):
        total = len(scored.matched_skills) + len(scored.missing_required)
        if scored.matched_skills:
            listed = ", ".join(scored.matched_skills[:4])
            suffix = "…" if len(scored.matched_skills) > 4 else ""
            reasons.append(
                f"{len(scored.matched_skills)}/{total} compétences requises couvertes ({listed}{suffix})."
            )
        else:
            reasons.append("Aucune des compétences requises n'apparaît explicitement dans votre CV.")

    exp_ratio = experience_ratio(
        profile.experience_years, requirements.min_experience_years, settings.experience_tolerance_years
    )
    if exp_ratio is not None and requirements.min_experience_years is not None:
        candidate_years = profile.experience_years or 0
        if exp_ratio >= 1.0:
            reasons.append(
                f"Votre expérience ({_years(candidate_years)}) répond à l'exigence de "
                f"{_years(requirements.min_experience_years)}."
            )
        else:
            reasons.append(
                f"Votre expérience ({_years(candidate_years)}) reste inférieure à l'exigence de "
                f"{_years(requirements.min_experience_years)}."
            )

    sen_ratio = seniority_ratio(profile.seniority, requirements.seniority)
    if sen_ratio is not None:
        candidate_level = _SENIORITY_LABELS[profile.seniority]
        required_level = _SENIORITY_LABELS[requirements.seniority]
        if sen_ratio >= 1.0:
            reasons.append(f"Votre niveau ({candidate_level}) correspond au niveau demandé ({required_level}).")
        else:
            reasons.append(f"Le poste demande un niveau {required_level}; votre profil indique {candidate_level}.")

    if requirements.location:
        arrangement = requirements.work_arrangement.value
        reasons.append(f"Poste à {requirements.location} ({arrangement}).")
    return reasons[:8]


def deterministic_recommendations(scored: ScoredJob) -> list[str]:
    recommendations: list[str] = []
    if scored.missing_required:
        listed = ", ".join(scored.missing_required[:3])
        suffix = "…" if len(scored.missing_required) > 3 else ""
        recommendations.append(
            f"Développez les compétences requises manquantes : {listed}{suffix}."
        )
    if scored.missing_preferred and not scored.missing_required:
        listed = ", ".join(scored.missing_preferred[:3])
        recommendations.append(f"Pour renforcer votre candidature : {listed}.")
    return recommendations[:4]


def deterministic_gaps(
    profile: CandidateProfile, requirements: JobRequirements, scored: ScoredJob, settings: Settings
) -> list[str]:
    gaps: list[str] = []
    if scored.missing_required:
        gaps.append("Compétences requises absentes du CV : " + ", ".join(scored.missing_required[:6]))
    if (
        requirements.min_experience_years is not None
        and profile.experience_years is not None
        and profile.experience_years < requirements.min_experience_years
    ):
        gaps.append(
            f"Années d'expérience : {_years(profile.experience_years)} sur "
            f"{_years(requirements.min_experience_years)} demandées."
        )
    if (seniority_ratio(profile.seniority, requirements.seniority) or 1.0) < 1.0:
        gaps.append("Niveau de séniorité inférieur au niveau demandé.")
    if requirements.education_requirements and not profile.education:
        gaps.append(
            f"Exigence de formation non vérifiable dans le CV : {requirements.education_requirements}."
        )
    return gaps[:8]


def _years(value: float) -> str:
    text = str(int(value)) if float(value).is_integer() else f"{value:g}"
    return f"{text} an{'s' if float(value) > 1 else ''}"
