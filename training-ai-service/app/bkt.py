from __future__ import annotations

from dataclasses import dataclass
from math import isfinite


@dataclass(frozen=True)
class BKTParameters:
    """Assumed BKT parameters (v1); these values have not been fitted to learner data."""

    initial_mastery: float = 0.25
    learn: float = 0.12
    guess: float = 0.20
    slip: float = 0.10
    version: str = "assumed-v1"

    def __post_init__(self) -> None:
        for name in ("initial_mastery", "learn", "guess", "slip"):
            value = getattr(self, name)
            if not isfinite(value) or not 0 <= value <= 1:
                raise ValueError(f"{name} must be a finite probability between 0 and 1")


@dataclass(frozen=True)
class BKTUpdate:
    prior: float
    observation_posterior: float
    next_prior: float


def update_mastery(prior: float, correct: bool, params: BKTParameters) -> BKTUpdate:
    if not isfinite(prior) or not 0 <= prior <= 1:
        raise ValueError("prior must be a finite probability between 0 and 1")
    if correct:
        numerator = prior * (1 - params.slip)
        denominator = numerator + (1 - prior) * params.guess
    else:
        numerator = prior * params.slip
        denominator = numerator + (1 - prior) * (1 - params.guess)
    posterior = numerator / denominator if denominator > 0 else prior
    next_prior = posterior + (1 - posterior) * params.learn
    return BKTUpdate(prior=prior, observation_posterior=posterior, next_prior=next_prior)


def recommendation_for(mastery: float, high_streak: int = 0) -> tuple[str, str]:
    """Transparent deterministic policy; mastery is an estimate, not professional proof."""
    if mastery < 0.4:
        return "foundational_review", "Revoir les fondamentaux puis refaire une évaluation courte."
    if mastery < 0.8 or high_streak < 2:
        return "targeted_practice", "Pratiquer les sous-compétences incertaines avec des exercices ciblés."
    return "advanced_tasks", "Passer à une tâche avancée tout en conservant des vérifications régulières."
