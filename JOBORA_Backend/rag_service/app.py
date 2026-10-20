from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from rag_store import RagStore


store = RagStore()


class IndexRequest(BaseModel):
    force: bool = False


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=800)
    top_k: int = Field(default=5, ge=1, le=10)


@asynccontextmanager
async def lifespan(_: FastAPI):
    store.ensure_index(False)
    yield


app = FastAPI(
    title="JOBORA Local RAG Service",
    version="1.0.0",
    description="Local-only semantic retrieval backed by persistent ChromaDB.",
    lifespan=lifespan,
)


@app.get("/health")
def health():
    status = store.status()
    if not status["available"]:
        raise HTTPException(status_code=503, detail="Local ChromaDB is unavailable.")
    return {"status": "ok", **status}


@app.get("/status")
def status():
    return store.status()


@app.post("/index")
def index(request: IndexRequest):
    try:
        return {"indexed": store.ensure_index(request.force), **store.status()}
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/search")
def search(request: SearchRequest):
    try:
        return {
            "query": request.query,
            "chunks": store.search(request.query, request.top_k),
            "embeddingModel": store.embedding_model,
        }
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host=os.getenv("RAG_SERVICE_HOST", "127.0.0.1"),
        port=int(os.getenv("RAG_SERVICE_PORT", "8001")),
    )
