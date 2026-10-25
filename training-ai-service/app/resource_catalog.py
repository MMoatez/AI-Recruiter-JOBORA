from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from .schemas import LearningResource, SkillGap


CATALOG_PATH = Path(__file__).resolve().parent.parent / "resources" / "catalog.json"


def _key(value: str) -> str:
    return "".join(character for character in value.casefold() if character.isalnum())


@lru_cache(maxsize=1)
def load_catalog() -> tuple[LearningResource, ...]:
    with CATALOG_PATH.open(encoding="utf-8") as catalog_file:
        records = json.load(catalog_file)
    return tuple(LearningResource.model_validate(record) for record in records)


class ResourceCatalog:
    def __init__(self, resources: tuple[LearningResource, ...] | None = None) -> None:
        self.resources = resources or load_catalog()

    def recommend(
        self, gaps: list[SkillGap], level: str, language: str, free_only: bool, limit: int = 12
    ) -> list[LearningResource]:
        priorities = {_key(gap.skill): gap.priority for gap in gaps if gap.status != "matched"}
        return self._rank(priorities, level, language, free_only, limit)

    def recommend_for_skills(
        self, skills: list[str], level: str, language: str, free_only: bool, limit: int = 12
    ) -> list[LearningResource]:
        return self._rank({_key(skill): 50 for skill in skills}, level, language, free_only, limit)

    def _rank(
        self, priorities: dict[str, int], level: str, language: str, free_only: bool, limit: int
    ) -> list[LearningResource]:
        if not priorities:
            return []
        ranked: list[tuple[int, str, LearningResource]] = []
        levels = {"beginner": 0, "intermediate": 1, "advanced": 2}
        for resource in self.resources:
            if free_only and resource.access != "free":
                continue
            matched = [priorities[_key(skill)] for skill in resource.skills if _key(skill) in priorities]
            if not matched:
                continue
            score = max(matched) * 10
            score += 30 if resource.access == "free" else 0
            score += 15 if language in resource.languages else 0
            if resource.level == "all" or resource.level == level:
                score += 20
            elif abs(levels[resource.level] - levels[level]) == 1:
                score += 5
            ranked.append((score, resource.title.casefold(), resource))
        ranked.sort(key=lambda item: (-item[0], item[1]))
        return [item[2] for item in ranked[:limit]]
