from __future__ import annotations

from fastapi import FastAPI

from .internal_matching import router as internal_matching_router
from .internal_training import router as internal_training_router


app = FastAPI(
    title="JOBORA Training AI Service",
    version="0.1.0",
    description="Internal, compute-only Training service called by the JOBORA NestJS backend.",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)
app.include_router(internal_training_router)
app.include_router(internal_matching_router)


@app.get("/internal/health")
def health() -> dict[str, str]:
    return {"status": "ok", "persistence": "nestjs-mongodb"}
