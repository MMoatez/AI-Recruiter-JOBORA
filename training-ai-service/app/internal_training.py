from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from .assessment_repository import CURATED_BANK, _slug
from .bkt import BKTParameters, recommendation_for, update_mastery
from .config import get_settings
from .groq_client import AIServiceError, GroqRoadmapClient
from .resource_catalog import ResourceCatalog
from .schemas import AIProvenance, TrainingAnalyzeRequest
from .skill_analysis import EmbeddingServiceError, SkillGapAnalyzer, select_embedding_model


router = APIRouter(prefix="/internal/training", tags=["internal-training"])
settings = get_settings()
catalog = ResourceCatalog()


def require_internal(x_training_internal_token: str = Header(default="")) -> None:
    if not settings.internal_token or x_training_internal_token != settings.internal_token:
        raise HTTPException(status_code=403, detail="Internal training service authentication failed.")


@router.post("/analyze", dependencies=[])
def analyze(request: TrainingAnalyzeRequest, x_training_internal_token: str = Header(default="")):
    require_internal(x_training_internal_token)
    try:
        selected, _, _ = select_embedding_model(settings.sentence_transformer_model,
            settings.use_finetuned_embeddings, str(settings.finetuned_checkpoint))
        analyzer = SkillGapAnalyzer(selected, settings.sentence_transformer_model) if selected != settings.sentence_transformer_model else SkillGapAnalyzer(selected)
        gaps = analyzer.analyze(request.candidate_skills, request.sanitized_cv_text, request.job_description)
        model_name, roadmap = GroqRoadmapClient(settings).generate(request, gaps)
        resources = catalog.recommend(gaps, request.current_level, request.preferred_language, request.free_only)
        return {"gaps": gaps, "roadmap": roadmap, "resources": resources,
                "provenance": AIProvenance(model=model_name)}
    except (ValueError, EmbeddingServiceError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except AIServiceError as error:
        raise HTTPException(status_code=error.status_code, detail=str(error)) from error


class SkillRequest(BaseModel):
    skill: str = Field(min_length=1, max_length=100)


@router.post("/curated-questions")
def curated_questions(request: SkillRequest, x_training_internal_token: str = Header(default="")):
    require_internal(x_training_internal_token)
    key = _slug(request.skill)
    rows = CURATED_BANK.get(key, [])
    return [{"id": f"q_{key}_{subskill}_v1", "concept_id": f"{key}:{subskill}", "skill": request.skill,
             "prompt": prompt, "choices": choices, "correct_choice": correct, "explanation": explanation,
             "difficulty": "beginner"} for subskill, prompt, choices, correct, explanation in rows]


class BKTRequest(BaseModel):
    prior: float | None = Field(default=None, ge=0, le=1)
    correct: bool


@router.post("/bkt/update")
def bkt_update(request: BKTRequest, x_training_internal_token: str = Header(default="")):
    require_internal(x_training_internal_token)
    parameters = BKTParameters()
    result = update_mastery(parameters.initial_mastery if request.prior is None else request.prior, request.correct, parameters)
    return {**result.__dict__, "parameter_version": parameters.version}


class ConceptRecommendation(BaseModel):
    concept_id: str
    skill: str
    mastery: float = Field(ge=0, le=1)
    high_streak: int = Field(default=0, ge=0)


class RecommendationRequest(BaseModel):
    concepts: list[ConceptRecommendation]


@router.post("/recommendations")
def recommendations(request: RecommendationRequest, x_training_internal_token: str = Header(default="")):
    require_internal(x_training_internal_token)
    result = []
    for concept in request.concepts:
        action, rationale = recommendation_for(concept.mastery, concept.high_streak)
        result.append({"concept_id": concept.concept_id, "skill": concept.skill, "mastery": concept.mastery,
                       "action": action, "rationale": rationale,
                       "disclaimer": "Estimation probabiliste BKT, pas une preuve de compétence professionnelle."})
    return sorted(result, key=lambda item: item["mastery"])
