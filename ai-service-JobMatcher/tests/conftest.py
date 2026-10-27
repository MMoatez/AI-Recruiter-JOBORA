from __future__ import annotations

import os
from typing import Any

import pytest
from pydantic import BaseModel

from app.providers.base import Provider, ProviderError
from app.schemas import (
    BatchJobAnalysisModelOutput,
    CandidateProfile,
    ProfileModelOutput,
    SemanticBatchModelOutput,
)

TEST_TOKEN = "test-internal-token"


@pytest.fixture(autouse=True)
def test_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Deterministic, non-secret environment for every test."""
    monkeypatch.setenv("JOB_MATCHER_INTERNAL_TOKEN", TEST_TOKEN)
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test_key_not_real")
    monkeypatch.setenv("GROQ_MODEL_JOB_MATCHER", "test-model")
    monkeypatch.setenv("GROQ_MAX_RETRIES", "2")
    monkeypatch.setenv("GROQ_TIMEOUT_SECONDS", "5")
    monkeypatch.setenv("JOB_MATCHER_PORT", "8010")
    monkeypatch.delenv("JOB_MATCHER_WEIGHT_REQUIRED_SKILLS", raising=False)
    monkeypatch.delenv("JOB_MATCHER_WEIGHT_PREFERRED_SKILLS", raising=False)
    monkeypatch.delenv("JOB_MATCHER_WEIGHT_EXPERIENCE", raising=False)
    monkeypatch.delenv("JOB_MATCHER_WEIGHT_SENIORITY", raising=False)
    monkeypatch.delenv("JOB_MATCHER_WEIGHT_SEMANTIC_FIT", raising=False)


class MockProvider(Provider):
    """Deterministic Provider double: canned responses by schema, or an error."""

    def __init__(
        self,
        responses: dict[type[BaseModel], dict[str, Any] | BaseModel] | None = None,
        error: ProviderError | None = None,
    ) -> None:
        self.responses = responses or {}
        self.error = error
        self.calls: list[tuple[str, str, type[BaseModel]]] = []

    @property
    def is_configured(self) -> bool:
        return self.error is None

    def complete_json(self, system: str, user: str, schema: type) -> Any:
        self.calls.append((system, user, schema))
        if self.error is not None:
            raise self.error
        response = self.responses.get(schema)
        if response is None:
            raise AssertionError(f"MockProvider has no response for {schema.__name__}")
        if isinstance(response, BaseModel):
            return response
        return schema.model_validate(response)


def default_profile_output(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "skills": ["Python", "FastAPI", "Docker"],
        "experience_years": 2,
        "seniority": "junior",
        "job_titles": ["Software Developer"],
        "languages": ["French", "English"],
        "education": ["Software Engineering"],
        "certifications": [],
        "preferred_locations": [],
        "work_preferences": [],
    }
    payload.update(overrides)
    return payload


def default_analysis_batch(job_count: int, **overrides: Any) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "required_skills": ["Python"],
        "preferred_skills": ["Docker"],
        "min_experience_years": 2,
        "seniority": "junior",
        "responsibilities": ["Build APIs"],
        "education_requirements": "",
        "location": "Paris",
        "work_arrangement": "hybrid",
        "languages": ["French"],
    }
    entry.update(overrides)
    return {"jobs": [dict(entry) for _ in range(job_count)]}


def semantic_output(entries: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "matches": [
            {
                "job_id": job_id,
                "semantic_fit": fit,
                "reasons": reasons,
                "recommendations": [],
            }
            for job_id, fit, reasons in entries
        ]
    }


@pytest.fixture
def mock_provider() -> MockProvider:
    return MockProvider(
        responses={
            ProfileModelOutput: default_profile_output(),
            BatchJobAnalysisModelOutput: default_analysis_batch(1),
            SemanticBatchModelOutput: semantic_output(
                [("job-1", 0.8, ["Le profil Python correspond au poste."])]
            ),
        }
    )


@pytest.fixture
def client(mock_provider: MockProvider):
    from fastapi.testclient import TestClient

    from app.main import app, get_provider

    app.dependency_overrides[get_provider] = lambda: mock_provider
    with TestClient(app) as test_client:
        yield test_client, mock_provider
    app.dependency_overrides.clear()


def auth(token: str = TEST_TOKEN) -> dict[str, str]:
    return {"x-job-matcher-internal-token": token}


def build_pdf(text: str) -> bytes:
    """Build a minimal single-page PDF containing `text` (no external libs)."""
    safe = text.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
    content = f"BT /F1 12 Tf 40 760 Td ({safe}) Tj ET".encode("latin-1")

    def obj(number: int, body: bytes) -> bytes:
        return f"{number} 0 obj\n".encode("latin-1") + body + b"\nendobj\n"

    objects = [
        obj(1, b"<< /Type /Catalog /Pages 2 0 R >>"),
        obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
        obj(
            3,
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        ),
        obj(4, f"<< /Length {len(content)} >>\nstream\n".encode("latin-1") + content + b"\nendstream"),
        obj(5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
    ]

    output = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for chunk in objects:
        offsets.append(len(output))
        output += chunk
    xref_position = len(output)
    output += f"xref\n0 {len(objects) + 1}\n".encode("latin-1")
    output += b"0000000000 65535 f \n"
    for offset in offsets[1:]:
        output += f"{offset:010d} 00000 n \n".encode("latin-1")
    output += (
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_position}\n%%EOF\n"
    ).encode("latin-1")
    return bytes(output)
