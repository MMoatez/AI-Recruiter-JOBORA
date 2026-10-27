from dataclasses import replace

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import internal_matching


app = FastAPI()
app.include_router(internal_matching.router)


def test_internal_matching_requires_token_and_returns_analyzer_contract(monkeypatch):
    monkeypatch.setattr(
        internal_matching,
        "settings",
        replace(internal_matching.settings, internal_token="test-internal-token"),
    )
    monkeypatch.setattr(
        internal_matching,
        "analyze_resume_match",
        lambda resume, job, model: {
            "compatibility_score": 78.5,
            "top_job_matches": [{"title": "Web Developer", "score": 91.25}],
            "algorithm": "SBERT cosine similarity",
        },
    )
    client = TestClient(app)
    payload = {"resume_text": "A candidate profile with enough readable content.",
               "job_description": "A job description with enough readable content."}

    denied = client.post("/internal/matching/analyze", json=payload)
    assert denied.status_code == 403

    response = client.post(
        "/internal/matching/analyze",
        json=payload,
        headers={"x-training-internal-token": "test-internal-token"},
    )
    assert response.status_code == 200
    assert response.json() == {
        "compatibility_score": 78.5,
        "top_job_matches": [{"title": "Web Developer", "score": 91.25}],
        "algorithm": "SBERT cosine similarity",
    }


def test_internal_matching_rejects_short_text(monkeypatch):
    monkeypatch.setattr(
        internal_matching,
        "settings",
        replace(internal_matching.settings, internal_token="test-internal-token"),
    )
    response = TestClient(app).post(
        "/internal/matching/analyze",
        json={"resume_text": "short", "job_description": "also short"},
        headers={"x-training-internal-token": "test-internal-token"},
    )
    assert response.status_code == 422
