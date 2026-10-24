from __future__ import annotations

import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from .schemas import CandidateSkillInput, SkillGap


SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "Docker": ("docker", "container", "conteneur", "containerization", "conteneurisation"),
    "Git": ("git", "github", "gitlab", "version control", "gestion de versions"),
    "Flutter": ("flutter", "dart"),
    "Firebase": ("firebase", "firestore", "cloud firestore"),
    "Python": ("python", "fastapi", "django", "flask"),
    "Java": ("java", "spring", "spring boot"),
    "React": ("react", "reactjs", "react.js"),
    "SQL": ("sql", "postgresql", "mysql", "sqlite", "base de données relationnelle"),
    "AWS": ("aws", "amazon web services"),
    "TypeScript": ("typescript",),
}

REQUIRED_MARKERS = ("required", "must", "mandatory", "requis", "exigé", "obligatoire", "maîtrise")
PREFERRED_MARKERS = ("preferred", "nice to have", "souhaité", "apprécié", "un plus")


@dataclass(frozen=True)
class Requirement:
    skill: str
    excerpt: str
    importance: str


class EmbeddingServiceError(RuntimeError):
    pass


@lru_cache(maxsize=2)
def load_embedding_model(model_name: str) -> Any:
    # Import lazily so health endpoints remain usable if the local ML runtime
    # is missing or has an incompatible native dependency.
    try:
        from sentence_transformers import SentenceTransformer

        return SentenceTransformer(model_name)
    except (ImportError, OSError, RuntimeError) as error:
        raise EmbeddingServiceError(
            "The multilingual embedding model could not be loaded. Check the local PyTorch CPU runtime."
        ) from error


def select_embedding_model(baseline: str, enabled: bool, checkpoint: str) -> tuple[str, str, str | None]:
    if not enabled:
        return baseline, "baseline", None
    path = Path(checkpoint)
    if not path.is_dir() or not (path / "modules.json").is_file():
        return baseline, "baseline_fallback", "Fine-tuned checkpoint is missing or incompatible."
    return str(path), "fine_tuned", None


def _contains_alias(text: str, alias: str) -> bool:
    return re.search(rf"(?<!\w){re.escape(alias)}(?!\w)", text, flags=re.IGNORECASE) is not None


def extract_requirements(job_description: str) -> list[Requirement]:
    lines = [line.strip(" •-*\t") for line in job_description.splitlines() if line.strip()]
    requirements: list[Requirement] = []
    for skill, aliases in SKILL_ALIASES.items():
        matching_lines = [line for line in lines if any(_contains_alias(line, alias) for alias in aliases)]
        if not matching_lines:
            continue
        excerpt = matching_lines[0][:500]
        lowered = excerpt.casefold()
        if any(marker in lowered for marker in REQUIRED_MARKERS):
            importance = "required"
        elif any(marker in lowered for marker in PREFERRED_MARKERS):
            importance = "preferred"
        else:
            importance = "required"
        requirements.append(Requirement(skill, excerpt, importance))
    return requirements


def extract_candidate_skills(skills: list[CandidateSkillInput], sanitized_text: str | None) -> list[CandidateSkillInput]:
    found = {skill.name.casefold(): skill for skill in skills}
    if sanitized_text:
        for canonical, aliases in SKILL_ALIASES.items():
            if canonical.casefold() not in found and any(_contains_alias(sanitized_text, alias) for alias in aliases):
                found[canonical.casefold()] = CandidateSkillInput(name=canonical, evidence=[])
    return list(found.values())


class SkillGapAnalyzer:
    def __init__(self, model_name: str, fallback_model_name: str | None = None) -> None:
        self.model_name = model_name
        self.fallback_model_name = fallback_model_name

    def analyze(
        self,
        candidate_skills: list[CandidateSkillInput],
        sanitized_text: str | None,
        job_description: str,
    ) -> list[SkillGap]:
        requirements = extract_requirements(job_description)
        if not requirements:
            raise ValueError("No supported technical requirements were detected in the job description")
        candidates = extract_candidate_skills(candidate_skills, sanitized_text)
        candidate_names = [item.name for item in candidates]
        try:
            model = load_embedding_model(self.model_name)
        except EmbeddingServiceError:
            if not self.fallback_model_name or self.fallback_model_name == self.model_name:
                raise
            model = load_embedding_model(self.fallback_model_name)
        requirement_vectors = model.encode([item.skill for item in requirements], normalize_embeddings=True)
        candidate_vectors = model.encode(candidate_names, normalize_embeddings=True) if candidate_names else []

        gaps: list[SkillGap] = []
        for index, requirement in enumerate(requirements):
            best_index = -1
            similarity = 0.0
            if candidate_names:
                scores = requirement_vectors[index] @ candidate_vectors.T
                best_index = int(scores.argmax())
                similarity = max(0.0, min(1.0, float(scores[best_index])))
            candidate = candidates[best_index] if best_index >= 0 else None
            exact = bool(candidate and candidate.name.casefold() == requirement.skill.casefold())
            evidence = candidate.evidence if candidate else []

            if exact and evidence:
                status = "matched"
                reasoning = "The skill is explicitly listed and supported by candidate-provided evidence."
            elif exact:
                status = "weakly_evidenced"
                reasoning = "The skill is explicitly listed, but no project or experience evidence was supplied."
            elif similarity >= 0.78 and candidate:
                status = "partial"
                reasoning = "A semantically related skill was found, but similarity alone does not prove proficiency."
            else:
                status = "missing"
                reasoning = "No explicit or sufficiently related candidate skill was found."

            base = {"required": 90, "preferred": 60, "bonus": 30}[requirement.importance]
            penalty = {"missing": 10, "weakly_evidenced": 7, "partial": 5, "matched": 0}[status]
            gaps.append(
                SkillGap(
                    skill=requirement.skill,
                    requirement_excerpt=requirement.excerpt,
                    importance=requirement.importance,
                    status=status,
                    similarity=round(similarity, 3),
                    priority=min(100, base + penalty),
                    matched_candidate_skill=candidate.name if candidate else None,
                    evidence=evidence,
                    reasoning=reasoning,
                )
            )
        return sorted(gaps, key=lambda gap: (-gap.priority, gap.skill))
