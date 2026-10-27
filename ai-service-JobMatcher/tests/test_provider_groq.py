from __future__ import annotations

import dataclasses

import httpx
import pytest

from app.config import get_settings
from app.providers.base import (
    ProviderAuthError,
    ProviderNotConfiguredError,
    ProviderRateLimitError,
    ProviderRequestError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
)
from app.providers.groq_provider import GroqProvider
from app.schemas import CandidateProfile


def make_provider(handler, *, retries: int = 2, sleeps: list[float] | None = None) -> GroqProvider:
    settings = dataclasses.replace(get_settings(), groq_max_retries=retries)
    return GroqProvider(
        settings,
        transport=httpx.MockTransport(handler),
        sleep=(sleeps.append if sleeps is not None else (lambda _seconds: None)),
    )


def json_response(payload: dict, status_code: int = 200) -> httpx.Response:
    return httpx.Response(status_code, json={"choices": [{"message": {"content": _dump(payload)}}]})


def _dump(payload: dict) -> str:
    import json

    return json.dumps(payload)


VALID_OUTPUT = {
    "skills": ["Python"],
    "experience_years": 2,
    "seniority": "junior",
    "job_titles": ["Dev"],
    "languages": [],
    "education": [],
    "certifications": [],
    "preferred_locations": [],
    "work_preferences": [],
}


def test_success_returns_validated_model() -> None:
    calls = {"n": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        assert request.url.path.endswith("/chat/completions")
        assert request.headers["Authorization"].startswith("Bearer ")
        return json_response(VALID_OUTPUT)

    provider = make_provider(handler)
    model = provider.complete_json("system", "user", CandidateProfile)
    assert model.skills == ["Python"]
    assert calls["n"] == 1


def test_rate_limit_retries_then_succeeds_with_backoff() -> None:
    sleeps: list[float] = []
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        if calls["n"] < 3:
            return httpx.Response(429, json={"error": {"message": "rate limited"}})
        return json_response(VALID_OUTPUT)

    provider = make_provider(handler, retries=2, sleeps=sleeps)
    model = provider.complete_json("system", "user", CandidateProfile)
    assert model.experience_years == 2
    assert calls["n"] == 3
    assert len(sleeps) == 2  # backoff before each retry


def test_rate_limit_exhausted_raises_rate_limit_error() -> None:
    provider = make_provider(lambda _r: httpx.Response(429, json={"error": {"message": "slow down"}}), retries=1)
    with pytest.raises(ProviderRateLimitError):
        provider.complete_json("system", "user", CandidateProfile)


def test_server_error_exhausted_raises_unavailable() -> None:
    provider = make_provider(lambda _r: httpx.Response(503, json={}), retries=1)
    with pytest.raises(ProviderUnavailableError):
        provider.complete_json("system", "user", CandidateProfile)


def test_timeout_raises_timeout_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("boom")

    provider = make_provider(handler, retries=1)
    with pytest.raises(ProviderTimeoutError):
        provider.complete_json("system", "user", CandidateProfile)


def test_network_error_raises_unavailable() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("boom")

    provider = make_provider(handler, retries=1)
    with pytest.raises(ProviderUnavailableError):
        provider.complete_json("system", "user", CandidateProfile)


def test_malformed_json_content_raises_response_error() -> None:
    response = httpx.Response(
        200, json={"choices": [{"message": {"content": "not json at all {"}}]}
    )
    provider = make_provider(lambda _r: response, retries=0)
    with pytest.raises(ProviderResponseError):
        provider.complete_json("system", "user", CandidateProfile)


def test_schema_violation_raises_response_error() -> None:
    bad = dict(VALID_OUTPUT, experience_years=-5)
    provider = make_provider(lambda _r: json_response(bad), retries=0)
    with pytest.raises(ProviderResponseError):
        provider.complete_json("system", "user", CandidateProfile)


def test_auth_error_fails_immediately_without_retry() -> None:
    calls = {"n": 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(401, json={"error": {"message": "invalid key"}})

    provider = make_provider(handler, retries=5)
    with pytest.raises(ProviderAuthError):
        provider.complete_json("system", "user", CandidateProfile)
    assert calls["n"] == 1


def test_bad_request_raises_request_error_with_status() -> None:
    provider = make_provider(
        lambda _r: httpx.Response(400, json={"error": {"message": "model not found"}}), retries=5
    )
    with pytest.raises(ProviderRequestError) as excinfo:
        provider.complete_json("system", "user", CandidateProfile)
    assert "400" in str(excinfo.value)
    assert "model not found" in str(excinfo.value)


def test_unconfigured_provider_raises_before_any_request() -> None:
    unconfigured = dataclasses.replace(get_settings(), groq_api_key="")
    provider = GroqProvider(unconfigured, transport=httpx.MockTransport(lambda _r: httpx.Response(200)))
    assert provider.is_configured is False
    with pytest.raises(ProviderNotConfiguredError):
        provider.complete_json("system", "user", CandidateProfile)


def test_error_payload_never_contains_prompt_or_cv_text() -> None:
    provider = make_provider(
        lambda _r: httpx.Response(400, json={"error": {"message": "bad request"}}), retries=0
    )
    try:
        provider.complete_json("system", "SECRET_CV_TEXT_HERE", CandidateProfile)
    except ProviderRequestError as error:
        assert "SECRET_CV_TEXT_HERE" not in str(error)
    else:  # pragma: no cover
        pytest.fail("expected ProviderRequestError")
