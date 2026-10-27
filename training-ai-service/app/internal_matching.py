from __future__ import annotations

import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import Field, StringConstraints
from typing import Annotated

from .config import get_settings
from .matching_analysis import analyze_resume_match
from .schemas import StrictModel
from .skill_analysis import EmbeddingServiceError


router = APIRouter(prefix="/internal/matching", tags=["internal-matching"])
settings = get_settings()
matching_token = os.getenv("CV_MATCHING_INTERNAL_TOKEN", "").strip()


class MatchingRequest(StrictModel):
    resume_text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=20000)]
    job_description: Annotated[str, StringConstraints(strip_whitespace=True, min_length=20, max_length=30000)]


class JobMatch(StrictModel):
    title: str
    score: float = Field(ge=0, le=100)


class MatchingResponse(StrictModel):
    compatibility_score: float = Field(ge=0, le=100)
    top_job_matches: list[JobMatch] = Field(max_length=5)
    algorithm: str


def require_internal(x_training_internal_token: str = Header(default="")) -> None:
    expected_token = matching_token or settings.internal_token
    if not expected_token or x_training_internal_token != expected_token:
        raise HTTPException(status_code=403, detail="Internal matching service authentication failed.")


@router.post("/analyze", response_model=MatchingResponse)
def analyze_matching(
    request: MatchingRequest,
    x_training_internal_token: str = Header(default=""),
) -> MatchingResponse:
    require_internal(x_training_internal_token)
    try:
        return MatchingResponse(**analyze_resume_match(
            request.resume_text,
            request.job_description,
            settings.sentence_transformer_model,
        ))
    except EmbeddingServiceError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
