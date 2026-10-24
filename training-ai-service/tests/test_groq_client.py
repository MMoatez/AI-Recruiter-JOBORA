import json
from types import SimpleNamespace

import httpx
import pytest
from groq import APITimeoutError, AuthenticationError, BadRequestError, PermissionDeniedError, RateLimitError

from app.groq_client import (
    AIAuthenticationError,
    AIOutputError,
    AIPermissionError,
    AIQuotaError,
    AITimeoutError,
    GroqRoadmapClient,
    STRICT_PLAN_SCHEMA,
    STRICT_PROJECTS_SCHEMA,
)
from app.schemas import SkillGap, TrainingAnalyzeRequest


def request(weekly_hours=2):
    return TrainingAnalyzeRequest(
        candidate_skills=[{"name": "Git", "level": "beginner", "evidence": []}],
        job_description="Docker is required for this software engineering role.",
        career_goal="Become a mobile engineer",
        current_level="beginner",
        weekly_hours=weekly_hours,
        target_weeks=2,
        preferred_language="en",
        free_only=True,
    )


def plan(hours):
    return {
        "title": "Docker foundations",
        "summary": "A practical two-week learning roadmap.",
        "weeks": [{
            "week": 1, "title": "Containers", "skills": ["Docker"],
            "tasks": [{
                "id": "docker_task_1", "title": "Build an image",
                "objective": "Understand images and containers.", "estimated_hours": hours,
                "exercise": "Containerize a small application.", "deliverables": ["Dockerfile"],
                "evaluation_criteria": ["Image builds successfully"],
            }],
        }],
    }


PROJECTS = {"projects": [{
    "title": "Containerized app",
    "description": "Package a small application in a reproducible container.",
    "skills": ["Docker"], "deliverables": ["Repository"],
    "evaluation_criteria": ["Runs from documented command"],
}]}


def client_with_responses(*responses):
    client = object.__new__(GroqRoadmapClient)
    client.settings = SimpleNamespace(groq_model="openai/gpt-oss-20b")
    values = iter(responses)
    client.client = SimpleNamespace(
        models=SimpleNamespace(list=lambda: SimpleNamespace(data=[SimpleNamespace(id="openai/gpt-oss-20b")])),
        chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_: next(values))),
    )
    return client


def completion(value):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(value)))])


def test_strict_schemas_meet_groq_object_requirements():
    def inspect_schema(schema):
        if schema.get("type") == "object":
            assert schema.get("additionalProperties") is False
            assert set(schema.get("required", [])) == set(schema.get("properties", {}))
            for child in schema["properties"].values():
                inspect_schema(child)
        if schema.get("type") == "array":
            inspect_schema(schema["items"])

    inspect_schema(STRICT_PLAN_SCHEMA)
    inspect_schema(STRICT_PROJECTS_SCHEMA)


def test_valid_structured_roadmap():
    gap = SkillGap(
        skill="Docker", requirement_excerpt="Docker is required", importance="required",
        status="missing", similarity=0, priority=100, reasoning="Missing",
    )
    client = client_with_responses(completion(plan(3)), completion(PROJECTS))
    model, result = client.generate(request(), [gap])
    assert model == "openai/gpt-oss-20b"
    assert result.weeks[0].tasks[0].id == "docker_task_1"


def test_rejects_roadmap_over_study_capacity():
    client = client_with_responses(completion(plan(5)), completion(PROJECTS))
    with pytest.raises(AIOutputError, match="exceeding"):
        client.generate(request(), [])


def test_rejects_malformed_structured_output():
    client = client_with_responses(completion({"unexpected": True}), completion({"unexpected": True}))
    with pytest.raises(AIOutputError, match="invalid structured"):
        client.generate(request(), [])


def test_regenerates_a_roadmap_part_after_pydantic_validation_failure():
    client = client_with_responses(completion({"unexpected": True}), completion(plan(2)), completion(PROJECTS))
    _, result = client.generate(request(), [])
    assert result.weeks[0].tasks[0].id == "docker_task_1"


def test_retries_once_when_groq_rejects_malformed_generated_json():
    calls = []
    provider_error = BadRequestError("Failed to generate JSON",
        response=httpx.Response(400, request=httpx.Request("POST", "https://api.groq.com")),
        body={"error": {"code": "json_validate_failed", "failed_generation": '{"weeks":['}})
    responses = iter([provider_error, completion(plan(2)), completion(PROJECTS)])
    client = object.__new__(GroqRoadmapClient)
    client.settings = SimpleNamespace(groq_model="openai/gpt-oss-20b")
    def create(**kwargs):
        calls.append(kwargs); value = next(responses)
        if isinstance(value, Exception): raise value
        return value
    client.client = SimpleNamespace(models=SimpleNamespace(list=lambda: SimpleNamespace(data=[SimpleNamespace(id="openai/gpt-oss-20b")])), chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    _, result = client.generate(request(), [])
    assert result.weeks[0].tasks[0].id == "docker_task_1"
    assert len(calls) == 3
    assert "exactly one concise task per week" in calls[0]["messages"][1]["content"]
    assert calls[0]["response_format"] == calls[1]["response_format"]
    assert calls[1]["response_format"]["json_schema"]["strict"] is True
    assert "previous attempt was rejected" in calls[1]["messages"][1]["content"]
    assert '{"weeks":[' in calls[1]["messages"][1]["content"]


def test_falls_back_to_json_object_but_keeps_domain_validation_after_two_provider_rejections():
    provider_error = lambda: BadRequestError("Failed to generate JSON",
        response=httpx.Response(400, request=httpx.Request("POST", "https://api.groq.com")),
        body={"error": {"code": "json_validate_failed", "failed_generation": '{"title":"broken'}})
    calls = []; responses = iter([provider_error(), provider_error(), completion(plan(2)), completion(PROJECTS)])
    client = object.__new__(GroqRoadmapClient); client.settings = SimpleNamespace(groq_model="openai/gpt-oss-20b")
    def create(**kwargs):
        calls.append(kwargs); value = next(responses)
        if isinstance(value, Exception): raise value
        return value
    client.client = SimpleNamespace(models=SimpleNamespace(list=lambda: SimpleNamespace(data=[SimpleNamespace(id="openai/gpt-oss-20b")])), chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    _, result = client.generate(request(), [])
    assert result.weeks[0].tasks[0].id == "docker_task_1"
    assert calls[0]["response_format"]["type"] == "json_schema"
    assert calls[1]["response_format"]["type"] == "json_schema"
    assert calls[2]["response_format"] == {"type": "json_object"}


@pytest.mark.parametrize(
    ("sdk_error", "domain_error"),
    [
        (AuthenticationError("bad key", response=httpx.Response(401, request=httpx.Request("POST", "https://api.groq.com")), body=None), AIAuthenticationError),
        (PermissionDeniedError("denied", response=httpx.Response(403, request=httpx.Request("POST", "https://api.groq.com")), body=None), AIPermissionError),
        (RateLimitError("limited", response=httpx.Response(429, request=httpx.Request("POST", "https://api.groq.com")), body=None), AIQuotaError),
        (APITimeoutError(httpx.Request("POST", "https://api.groq.com")), AITimeoutError),
    ],
)
def test_provider_failures_are_mapped(sdk_error, domain_error):
    client = object.__new__(GroqRoadmapClient)
    client.settings = SimpleNamespace(groq_model="openai/gpt-oss-20b")
    client.client = SimpleNamespace(
        models=SimpleNamespace(list=lambda: SimpleNamespace(data=[SimpleNamespace(id="openai/gpt-oss-20b")])),
        chat=SimpleNamespace(completions=SimpleNamespace(create=lambda **_: (_ for _ in ()).throw(sdk_error))),
    )
    with pytest.raises(domain_error):
        client.generate(request(), [])
