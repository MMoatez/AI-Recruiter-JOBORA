"""Job Matcher AI service (FastAPI).

Endpoints are internal: NestJS calls them with a shared token. The browser
never talks to this service or to Groq.
"""

from __future__ import annotations

import logging
from typing import Annotated

import uvicorn
from fastapi import Depends, FastAPI, Header, HTTPException, Request, UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile

from .config import Settings, get_settings
from .cv_parser import CvParseError, extract_text, normalize_text
from .job_analyzer import analyze_job, analyze_jobs, requirements_summary
from .matching_engine import (
    deterministic_gaps,
    deterministic_reasons,
    deterministic_recommendations,
    eligibility_reason,
    score_job,
)
from .profile_extractor import extract_profile
from .prompts import SEMANTIC_SYSTEM, semantic_user_payload
from .providers.base import (
    Provider,
    ProviderAuthError,
    ProviderError,
    ProviderNotConfiguredError,
    ProviderRequestError,
    ProviderResponseError,
)
from .providers.groq_provider import GroqProvider
from .ranking import rank_results, shortlist
from .schemas import (
    AnalyzeJobRequest,
    AnalyzeJobResponse,
    CandidateProfile,
    ExcludedJob,
    JobInput,
    JobRequirements,
    MatchRequest,
    MatchResponse,
    MatchResult,
    ParseCvResponse,
    ScoreBreakdown,
    SemanticBatchModelOutput,
    SemanticMatchModelOutput,
)

logger = logging.getLogger("job_matcher")

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
_SEMANTIC_BATCH = 8
ALGORITHM = "hybrid-deterministic-weighted-v1+groq-semantic"

app = FastAPI(
    title="JOBORA Job Matcher AI Service",
    version="0.1.0",
    description="Internal FastAPI service: CV profiling, job analysis and ranked job matching.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

_provider: Provider | None = None


def get_provider() -> Provider:
    global _provider
    if _provider is None:
        _provider = GroqProvider(get_settings())
    return _provider


def require_internal_token(
    x_job_matcher_internal_token: Annotated[str, Header()] = "",
) -> None:
    """Shared-secret check (fail closed when no token is configured)."""
    expected = get_settings().internal_token
    if not expected or x_job_matcher_internal_token != expected:
        raise HTTPException(status_code=403, detail="Internal matching service authentication failed.")


TokenDep = Annotated[None, Depends(require_internal_token)]
ProviderDep = Annotated[Provider, Depends(get_provider)]


def _raise_provider_error(error: ProviderError) -> None:
    status = 502 if isinstance(error, (ProviderAuthError, ProviderRequestError, ProviderResponseError)) else 503
    logger.warning("provider_error type=%s status=%s", type(error).__name__, status)
    raise HTTPException(status_code=status, detail=str(error))


@app.get("/health")
def health(provider: ProviderDep) -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "job-matcher",
        "provider": "groq",
        "provider_configured": provider.is_configured,
        "model": settings.groq_model,
        "port": settings.port,
    }


async def _read_cv_payload(request: Request) -> tuple[UploadFile | None, str]:
    """Accept both JSON ({"cv_text": "..."}) and multipart form uploads.

    The NestJS backend posts JSON for CVs it already stored; direct service
    callers may upload a PDF. Both are trusted internal callers.
    """
    content_type = request.headers.get("content-type", "").lower()
    if content_type.startswith("multipart/form-data") or content_type.startswith(
        "application/x-www-form-urlencoded"
    ):
        form = await request.form()
        candidate = form.get("file")
        upload = candidate if isinstance(candidate, StarletteUploadFile) else None
        raw_text = form.get("cv_text")
        return upload, raw_text if isinstance(raw_text, str) else ""
    try:
        body = await request.json()
    except Exception as error:  # empty or malformed body
        raise HTTPException(status_code=400, detail="Provide a PDF file or cv_text.") from error
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Provide a PDF file or cv_text.")
    raw_text = body.get("cv_text")
    return None, raw_text if isinstance(raw_text, str) else ""


@app.post("/parse-cv", response_model=ParseCvResponse)
async def parse_cv(
    request: Request,
    provider: ProviderDep,
    _token: TokenDep,
) -> ParseCvResponse:
    settings = get_settings()
    file, cv_text = await _read_cv_payload(request)
    if file is None and not cv_text:
        raise HTTPException(status_code=400, detail="Provide a PDF file or cv_text.")
    try:
        if file is not None:
            filename = (file.filename or "").lower()
            if file.content_type not in (None, "application/pdf") and not filename.endswith(".pdf"):
                raise CvParseError("Only PDF files are accepted.")
            data = await file.read()
            if len(data) > MAX_UPLOAD_BYTES:
                raise CvParseError("The PDF exceeds the 5 MB limit.")
            text = extract_text(
                data, max_chars=settings.max_cv_chars, min_chars=settings.min_cv_chars
            )
        else:
            text = normalize_text(cv_text)
            if len(text) < settings.min_cv_chars:
                raise CvParseError("The CV text does not contain enough readable content.")
            text = text[: settings.max_cv_chars]
    except CvParseError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    try:
        profile = extract_profile(text, provider)
    except ProviderError as error:
        _raise_provider_error(error)
        raise  # pragma: no cover - _raise_provider_error always raises
    return ParseCvResponse(profile=profile, extracted_text_length=len(text), redacted=True)


@app.post("/analyze-job", response_model=AnalyzeJobResponse)
def analyze_job_endpoint(request: AnalyzeJobRequest, provider: ProviderDep, _token: TokenDep) -> AnalyzeJobResponse:
    try:
        requirements = analyze_job(request.job, provider, get_settings())
    except ProviderError as error:
        _raise_provider_error(error)
        raise  # pragma: no cover
    except ValueError as error:
        raise HTTPException(status_code=502, detail="The AI provider returned an unexpected payload.") from error
    return AnalyzeJobResponse(requirements=requirements)


@app.post("/match-jobs", response_model=MatchResponse)
def match_jobs(request: MatchRequest, provider: ProviderDep, _token: TokenDep) -> MatchResponse:
    settings = get_settings()
    if len(request.jobs) > settings.max_jobs:
        raise HTTPException(
            status_code=400, detail=f"At most {settings.max_jobs} jobs can be analyzed per request."
        )

    try:
        requirements_by_id = analyze_jobs(request.jobs, provider, settings)
    except ProviderError as error:
        _raise_provider_error(error)
        raise  # pragma: no cover
    except ValueError as error:
        raise HTTPException(status_code=502, detail="The AI provider returned an unexpected payload.") from error

    profile = request.profile
    eligible: list[JobInput] = []
    excluded: list[ExcludedJob] = []
    for job in request.jobs:
        requirements = requirements_by_id[job.job_id]
        reason = eligibility_reason(profile, requirements, settings)
        if reason:
            excluded.append(ExcludedJob(job_id=job.job_id, reason=reason))
        else:
            eligible.append(job)

    if not eligible:
        return MatchResponse(
            results=[],
            total_jobs_analyzed=len(request.jobs),
            total_jobs_eligible=0,
            excluded_jobs=excluded,
            weights=settings.normalized_weights,
            algorithm=ALGORITHM,
        )

    scored = {job.job_id: score_job(profile, requirements_by_id[job.job_id], settings) for job in eligible}
    scores = {job_id: item.score for job_id, item in scored.items()}
    top_ids = shortlist(scores, min(request.options.explain_top_n or settings.explain_top_n, len(eligible)))

    semantic: dict[str, SemanticMatchModelOutput] = {}
    if top_ids:
        jobs_by_id = {job.job_id: job for job in eligible}
        for start in range(0, len(top_ids), _SEMANTIC_BATCH):
            batch_ids = top_ids[start : start + _SEMANTIC_BATCH]
            pairs = [
                (
                    jobs_by_id[job_id],
                    {
                        **requirements_summary(requirements_by_id[job_id]),
                        "matched_skills": scored[job_id].matched_skills,
                        "missing_required_skills": scored[job_id].missing_required,
                    },
                )
                for job_id in batch_ids
            ]
            try:
                output = provider.complete_json(
                    SEMANTIC_SYSTEM, semantic_user_payload(profile, pairs), SemanticBatchModelOutput
                )
            except ProviderError as error:
                _raise_provider_error(error)
                raise  # pragma: no cover
            allowed = set(batch_ids)
            for entry in output.matches:
                if entry.job_id in allowed:
                    semantic[entry.job_id] = entry
        for job_id, entry in semantic.items():
            scored[job_id] = score_job(profile, requirements_by_id[job_id], settings, semantic_fit=entry.semantic_fit)

    results: list[MatchResult] = []
    for job in eligible:
        item = scored[job_id := job.job_id]
        if item.score is None:
            continue  # no known signal: never invent a score
        requirements = requirements_by_id[job_id]
        entry = semantic.get(job_id)
        reasons = deterministic_reasons(profile, requirements, item, settings)
        recommendations = deterministic_recommendations(item)
        if entry:
            model_reasons = [r.strip() for r in entry.reasons if r.strip()]
            model_recommendations = [r.strip() for r in entry.recommendations if r.strip()]
            reasons = _dedupe_texts(model_reasons + reasons)[:8]
            recommendations = _dedupe_texts(model_recommendations + recommendations)[:6]
        results.append(
            MatchResult(
                job_id=job_id,
                job_title=job.title,
                company=job.company,
                location=requirements.location or job.location,
                work_arrangement=requirements.work_arrangement,
                compatibility_score=item.score,
                matched_skills=item.matched_skills,
                missing_required_skills=item.missing_required,
                missing_preferred_skills=item.missing_preferred,
                semantic_fit=entry.semantic_fit if entry else None,
                reasons=reasons,
                recommendations=recommendations,
                gaps=deterministic_gaps(profile, requirements, item, settings),
                score_breakdown=ScoreBreakdown(
                    required_skills=item.breakdown.get("required_skills"),
                    preferred_skills=item.breakdown.get("preferred_skills"),
                    experience=item.breakdown.get("experience"),
                    seniority=item.breakdown.get("seniority"),
                    semantic_fit=item.breakdown.get("semantic_fit"),
                    applicable_weight_total=item.applicable_weight_total,
                ),
            )
        )

    return MatchResponse(
        results=rank_results(results, request.options.top_n),
        total_jobs_analyzed=len(request.jobs),
        total_jobs_eligible=len(eligible),
        excluded_jobs=excluded,
        weights=settings.normalized_weights,
        algorithm=ALGORITHM,
    )


def _dedupe_texts(texts: list[str]) -> list[str]:
    seen: set[str] = set()
    unique: list[str] = []
    for text in texts:
        key = text.lower().strip()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(text)
    return unique


if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run("app.main:app", host=settings.host, port=settings.port)
