from typing import Literal
from pydantic import BaseModel, Field

Level = Literal["junior", "intermediaire", "senior"]


class OfferAnalysis(BaseModel):
    job_title: str
    level: Level
    skills: list[str]
    technologies: list[str]
    soft_skills: list[str]


class LLMQuestion(BaseModel):
    """Ce que le LLM doit produire : volontairement simple."""
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    expected_answer: str
    explanation: str


class Verdict(BaseModel):
    """Résultat de la relecture : la réponse est-elle appuyée par la documentation ?"""
    supported: bool
    reason: str


class Question(BaseModel):
    """Question finale : skill, type, niveau et source sont fixés par le CODE, pas par le LLM."""
    skill: str
    type: Literal["qcm", "ouverte", "technique", "rh"]
    question: str
    options: list[str] = []
    correct_index: int | None = None
    expected_answer: str
    explanation: str
    difficulty: Level
    source: str | None = None
    verified: bool | None = None   # True = confirmée par la base ; None = non vérifiable