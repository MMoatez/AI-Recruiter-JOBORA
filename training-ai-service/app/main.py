from __future__ import annotations

import sqlite3
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .assessment_repository import AssessmentRepository
from .db import Database
from .document_extraction import DocumentExtractionError, extract_document
from .groq_client import AIServiceError, GroqRoadmapClient
from .groq_status import get_groq_status
from .repository import TrainingRepository
from .resource_catalog import ResourceCatalog
from .schemas import (
    AIStatusResponse,
    ErrorDetail,
    ErrorResponse,
    DocumentExtractionResponse,
    HealthResponse,
    Identifier,
    LearningPlanResponse,
    LearningResource,
    PlanCreateRequest,
    TaskProgressResponse,
    TaskProgressUpdate,
    TrainingAnalysisResponse,
    TrainingAnalyzeRequest,
    AIProvenance,
    AdaptiveRecommendation,
    AssessmentCreateRequest,
    AssessmentResultResponse,
    AssessmentSessionResponse,
    AssessmentSubmitRequest,
    MasteryPoint,
    PendingQuestionResponse,
    QuestionGenerationRequest,
    EmbeddingStatusResponse,
)
from .skill_analysis import EmbeddingServiceError, SkillGapAnalyzer, select_embedding_model
from .internal_training import router as internal_training_router


settings = get_settings()
database = Database(settings.database_path)
repository = TrainingRepository(database)
assessment_repository = AssessmentRepository(database)
resource_catalog = ResourceCatalog()


@asynccontextmanager
async def lifespan(_: FastAPI):
    database.initialize()
    yield


app = FastAPI(
    title="AI Recruiter Training API",
    version="0.1.0",
    description=(
        "Training-module backend. Authentication is not implemented yet; "
        "client-supplied user references are untrusted development identifiers."
    ),
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
)
app.include_router(internal_training_router)


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


@app.middleware("http")
async def attach_request_id(request: Request, call_next):
    if settings.local_demo_only and request.url.path.startswith("/api/v1/training"):
        client_host = request.client.host if request.client else ""
        if client_host not in {"127.0.0.1", "::1", "localhost", "testclient"}:
            payload = ErrorResponse(error=ErrorDetail(
                code="local_demo_only",
                message="Training endpoints are restricted to this machine because authentication is not implemented.",
                request_id=uuid4().hex,
            ))
            return JSONResponse(status_code=403, content=payload.model_dump())
    supplied = request.headers.get("X-Request-ID", "")
    request.state.request_id = supplied[:128] if supplied.isascii() and supplied else uuid4().hex
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    fields = {".".join(str(part) for part in item["loc"]): item["msg"] for item in error.errors()}
    payload = ErrorResponse(
        error=ErrorDetail(
            code="validation_error",
            message="The request contains invalid or missing fields.",
            request_id=_request_id(request),
            fields=fields,
        )
    )
    return JSONResponse(status_code=422, content=payload.model_dump())


@app.exception_handler(HTTPException)
async def http_error(request: Request, error: HTTPException) -> JSONResponse:
    detail = error.detail if isinstance(error.detail, dict) else {}
    payload = ErrorResponse(
        error=ErrorDetail(
            code=str(detail.get("code") or ("not_found" if error.status_code == 404 else "request_error")),
            message=str(detail.get("message") or error.detail),
            request_id=_request_id(request),
        )
    )
    return JSONResponse(status_code=error.status_code, content=payload.model_dump())


@app.exception_handler(Exception)
async def unexpected_error(request: Request, _: Exception) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorDetail(
            code="internal_error",
            message="The server could not complete the request.",
            request_id=_request_id(request),
        )
    )
    return JSONResponse(status_code=500, content=payload.model_dump())


@app.get("/api/v1/health", response_model=HealthResponse)
def health() -> HealthResponse:
    try:
        database.ping()
        return HealthResponse(status="ok", database="available", version=app.version)
    except (OSError, sqlite3.Error):
        return HealthResponse(status="degraded", database="unavailable", version=app.version)


@app.get("/api/v1/ai/status", response_model=AIStatusResponse)
def ai_status() -> AIStatusResponse:
    return get_groq_status(settings)


@app.get("/api/v1/training/embedding/status", response_model=EmbeddingStatusResponse)
def embedding_status() -> EmbeddingStatusResponse:
    model, source, reason = select_embedding_model(settings.sentence_transformer_model,
        settings.use_finetuned_embeddings, str(settings.finetuned_checkpoint))
    return EmbeddingStatusResponse(active_source=source, active_model=model,
        baseline_model=settings.sentence_transformer_model, fine_tuned_enabled=settings.use_finetuned_embeddings,
        fallback_reason=reason)


@app.post("/api/v1/training/documents/extract", response_model=DocumentExtractionResponse)
async def extract_training_document(file: UploadFile = File(...)) -> DocumentExtractionResponse:
    filename = (file.filename or "document").replace("\\", "/").split("/")[-1][:200]
    try:
        content = await file.read()
        text, truncated = extract_document(filename, content)
        return DocumentExtractionResponse(
            filename=filename, text=text, character_count=len(text), truncated=truncated
        )
    except DocumentExtractionError as error:
        raise HTTPException(
            status_code=422,
            detail={"code": "document_extraction_failed", "message": str(error)},
        ) from error
    finally:
        await file.close()


@app.get("/api/v1/training/resources", response_model=list[LearningResource])
def list_training_resources(
    skills: str = Query(default="", max_length=1000),
    level: str = Query(default="beginner", pattern="^(beginner|intermediate|advanced)$"),
    language: str = Query(default="en", pattern="^(fr|en)$"),
    free_only: bool = True,
) -> list[LearningResource]:
    requested = [skill.strip() for skill in skills.split(",") if skill.strip()]
    return resource_catalog.recommend_for_skills(requested, level, language, free_only)


@app.post("/api/v1/training/plans", response_model=LearningPlanResponse, status_code=201)
def create_plan(request: PlanCreateRequest) -> LearningPlanResponse:
    return repository.create_draft(request)


@app.get("/api/v1/training/plans/{plan_id}", response_model=LearningPlanResponse)
def get_plan(plan_id: Identifier) -> LearningPlanResponse:
    plan = repository.get(plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail="Learning plan not found.")
    return plan


@app.patch(
    "/api/v1/training/plans/{plan_id}/tasks/{task_id}/progress",
    response_model=TaskProgressResponse,
)
def update_task_progress(
    plan_id: Identifier, task_id: Identifier, update: TaskProgressUpdate
) -> TaskProgressResponse:
    progress = repository.update_progress(plan_id, task_id, update)
    if progress is None:
        raise HTTPException(status_code=404, detail="Learning plan not found.")
    return progress


@app.post("/api/v1/training/analyze", response_model=TrainingAnalysisResponse, status_code=201)
def analyze_training(request: TrainingAnalyzeRequest) -> TrainingAnalysisResponse:
    try:
        selected_model, _, _ = select_embedding_model(settings.sentence_transformer_model,
            settings.use_finetuned_embeddings, str(settings.finetuned_checkpoint))
        analyzer = (SkillGapAnalyzer(selected_model, settings.sentence_transformer_model)
                    if selected_model != settings.sentence_transformer_model else SkillGapAnalyzer(selected_model))
        gaps = analyzer.analyze(
            request.candidate_skills, request.sanitized_cv_text, request.job_description
        )
        model_name, roadmap = GroqRoadmapClient(settings).generate(request, gaps)
        resources = resource_catalog.recommend(gaps, request.current_level, request.preferred_language, request.free_only)
        plan = repository.save_analysis(request, gaps, roadmap, resources, model_name)
        return TrainingAnalysisResponse(
            plan_id=plan.id,
            gaps=gaps,
            roadmap=roadmap,
            resources=resources,
            provenance=AIProvenance(model=model_name),
            created_at=plan.created_at,
        )
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except EmbeddingServiceError as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "embedding_model_unavailable", "message": str(error)},
        ) from error
    except AIServiceError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": str(error)}) from error
@app.post("/api/v1/training/assessments", response_model=AssessmentSessionResponse, status_code=201)
def create_assessment(request: AssessmentCreateRequest) -> AssessmentSessionResponse:
    try:
        session = assessment_repository.create(request)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    if session is None:
        raise HTTPException(status_code=404, detail={"code": "reviewed_bank_unavailable", "message": "No reviewed question bank is available for this skill yet."})
    return session


@app.post("/api/v1/training/assessments/{session_id}/submit", response_model=AssessmentResultResponse)
def submit_assessment(session_id: Identifier, request: AssessmentSubmitRequest) -> AssessmentResultResponse:
    try:
        return assessment_repository.submit(session_id, request)
    except LookupError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except FileExistsError as error:
        raise HTTPException(status_code=409, detail={"code": "duplicate_submission", "message": str(error)}) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.get("/api/v1/training/mastery", response_model=list[MasteryPoint])
def mastery_history(user_reference: Identifier = "development-user") -> list[MasteryPoint]:
    return assessment_repository.history(user_reference)


@app.get("/api/v1/training/recommendations", response_model=list[AdaptiveRecommendation])
def adaptive_recommendations(user_reference: Identifier = "development-user") -> list[AdaptiveRecommendation]:
    return assessment_repository.recommendations(user_reference)


@app.post("/api/v1/training/questions/generate", response_model=PendingQuestionResponse, status_code=201)
def generate_question_for_review(request: QuestionGenerationRequest) -> PendingQuestionResponse:
    """Development-only: generated keys remain private and pending items are never selected for scoring."""
    try:
        _, question = GroqRoadmapClient(settings).generate_question(request)
        return assessment_repository.store_pending(request, question)
    except AIServiceError as error:
        raise HTTPException(status_code=error.status_code, detail={"code": error.code, "message": str(error)}) from error

