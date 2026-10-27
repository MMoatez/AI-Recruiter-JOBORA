from __future__ import annotations

import json

from groq import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    Groq,
    InternalServerError,
    PermissionDeniedError,
    RateLimitError,
)
from pydantic import ValidationError

from .config import Settings
from .prompts import ROADMAP_SYSTEM_PROMPT
from .schemas import (
    GeneratedPortfolioProjects,
    GeneratedRoadmap,
    GeneratedRoadmapPlan,
    GeneratedQuestionKey,
    QuestionGenerationRequest,
    SkillGap,
    TrainingAnalyzeRequest,
)


class AIServiceError(RuntimeError):
    code = "ai_service_error"
    status_code = 502


class AIConfigurationError(AIServiceError):
    code = "groq_not_configured"
    status_code = 503


class AIAuthenticationError(AIServiceError):
    code = "groq_authentication_failed"
    status_code = 401


class AIPermissionError(AIServiceError):
    code = "groq_permission_denied"
    status_code = 403


class AIQuotaError(AIServiceError):
    code = "groq_quota_exceeded"
    status_code = 429


class AITimeoutError(AIServiceError):
    code = "groq_timeout"
    status_code = 504


class AIOutputError(AIServiceError):
    code = "invalid_model_output"
    status_code = 502


# Groq strict mode requires all object properties to be required and every
# object to reject additional properties. Domain length/range rules are applied
# again through GeneratedRoadmap after transport validation.
STRICT_ROADMAP_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "title": {"type": "string"},
        "summary": {"type": "string"},
        "weeks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "week": {"type": "integer"},
                    "title": {"type": "string"},
                    "skills": {"type": "array", "items": {"type": "string"}},
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "id": {"type": "string"},
                                "title": {"type": "string"},
                                "objective": {"type": "string"},
                                "estimated_hours": {"type": "number"},
                                "exercise": {"type": "string"},
                                "deliverables": {"type": "array", "items": {"type": "string"}},
                                "evaluation_criteria": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": [
                                "id", "title", "objective", "estimated_hours", "exercise",
                                "deliverables", "evaluation_criteria",
                            ],
                        },
                    },
                },
                "required": ["week", "title", "skills", "tasks"],
            },
        },
        "projects": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "title": {"type": "string"},
                    "description": {"type": "string"},
                    "skills": {"type": "array", "items": {"type": "string"}},
                    "deliverables": {"type": "array", "items": {"type": "string"}},
                    "evaluation_criteria": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "description", "skills", "deliverables", "evaluation_criteria"],
            },
        },
    },
    "required": ["title", "summary", "weeks", "projects"],
}

STRICT_PLAN_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {key: STRICT_ROADMAP_SCHEMA["properties"][key] for key in ("title", "summary", "weeks")},
    "required": ["title", "summary", "weeks"],
}

STRICT_PROJECTS_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {"projects": STRICT_ROADMAP_SCHEMA["properties"]["projects"]},
    "required": ["projects"],
}

STRICT_QUESTION_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "properties": {"prompt": {"type": "string"}, "choices": {"type": "array", "items": {"type": "string"}},
                   "correct_choice": {"type": "integer"}, "explanation": {"type": "string"}},
    "required": ["prompt", "choices", "correct_choice", "explanation"],
}


class GroqRoadmapClient:
    STRICT_MODELS = {"openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"}

    def __init__(self, settings: Settings) -> None:
        if not settings.groq_api_key:
            raise AIConfigurationError("GROQ_API_KEY is not configured on the backend.")
        if not settings.groq_model:
            raise AIConfigurationError("GROQ_MODEL is not configured on the backend.")
        self.settings = settings
        self.client = Groq(
            api_key=settings.groq_api_key,
            timeout=settings.groq_timeout_seconds,
            max_retries=0,
        )

    def select_model(self) -> str:
        available = {model.id for model in self.client.models.list().data}
        if self.settings.groq_model not in available:
            raise AIConfigurationError("GROQ_MODEL is not available to the configured API key.")
        if self.settings.groq_model not in self.STRICT_MODELS:
            raise AIConfigurationError("GROQ_MODEL does not support strict JSON Schema output.")
        return self.settings.groq_model

    def generate(self, request: TrainingAnalyzeRequest, gaps: list[SkillGap]) -> tuple[str, GeneratedRoadmap]:
        model = self.select_model()
        safe_payload = {
            "career_goal": request.career_goal,
            "current_level": request.current_level,
            "weekly_hours": request.weekly_hours,
            "target_weeks": request.target_weeks,
            "preferred_language": request.preferred_language,
            "skill_gaps": [gap.model_dump(exclude={"evidence"}) for gap in gaps if gap.status != "matched"],
        }
        try:
            plan = self._validated_part(
                model,
                "learning_plan",
                STRICT_PLAN_SCHEMA,
                "Create only the title, summary, and weekly roadmap from this validated JSON data. "
                "Return exactly target_weeks week objects and exactly one concise task per week. "
                "Keep every text field concise and do not use double-quote characters inside string values:\n"
                + json.dumps(safe_payload, ensure_ascii=False),
                GeneratedRoadmapPlan,
            )
            projects = self._validated_part(
                model,
                "portfolio_projects",
                STRICT_PROJECTS_SCHEMA,
                "Create one or more practical portfolio projects for this validated roadmap data. "
                "Do not name external courses, certificates, or URLs:\n"
                + json.dumps({"constraints": safe_payload, "roadmap": plan.model_dump()}, ensure_ascii=False),
                GeneratedPortfolioProjects,
            )
            roadmap = GeneratedRoadmap.model_validate({**plan.model_dump(), **projects.model_dump()})
        except AuthenticationError as error:
            raise AIAuthenticationError("Groq rejected the API key.") from error
        except PermissionDeniedError as error:
            raise AIPermissionError("Groq denied access to the configured model.") from error
        except RateLimitError as error:
            raise AIQuotaError("Groq rate limit or quota was exceeded.") from error
        except APITimeoutError as error:
            raise AITimeoutError("Groq did not respond before the configured timeout.") from error
        except (APIConnectionError, InternalServerError) as error:
            raise AIServiceError("Groq is temporarily unavailable.") from error
        except BadRequestError as error:
            raise AIOutputError("Groq rejected the structured-output request.") from error
        except APIStatusError as error:
            raise AIServiceError("Groq returned an unexpected service error.") from error
        except (ValidationError, json.JSONDecodeError, TypeError, ValueError) as error:
            raise AIOutputError("Groq returned an invalid structured roadmap.") from error

        total_hours = sum(task.estimated_hours for week in roadmap.weeks for task in week.tasks)
        if total_hours > request.weekly_hours * request.target_weeks:
            raise AIOutputError("Groq produced a roadmap exceeding the requested study capacity.")
        if max(week.week for week in roadmap.weeks) > request.target_weeks:
            raise AIOutputError("Groq produced stages beyond the requested duration.")
        task_ids = [task.id for week in roadmap.weeks for task in week.tasks]
        if len(task_ids) != len(set(task_ids)):
            raise AIOutputError("Groq produced duplicate task identifiers.")
        return model, roadmap

    def _validated_part(self, model: str, name: str, schema: dict, prompt: str, model_type):
        validation_note = ""
        for attempt in range(2):
            try:
                return model_type.model_validate(self._strict_completion(model, name, schema, prompt + validation_note))
            except ValidationError as error:
                if attempt:
                    raise
                issues = [{"location": list(item["loc"]), "message": item["msg"]} for item in error.errors()]
                validation_note = (
                    "\nThe previous JSON object failed application validation. Generate a complete replacement "
                    "that fixes these errors and still follows every original constraint:\n"
                    + json.dumps(issues, ensure_ascii=False)
                )

    def generate_question(self, request: QuestionGenerationRequest) -> tuple[str, GeneratedQuestionKey]:
        try:
            model = self.select_model()
            value = self._strict_completion(model, "assessment_question", STRICT_QUESTION_SCHEMA,
                "Create one unambiguous multiple-choice item with exactly one defensible correct answer. "
                "It will require human review before scoring. "
                f"Skill: {request.skill}; concept: {request.concept_id}; difficulty: {request.difficulty}.")
            return model, GeneratedQuestionKey.model_validate(value)
        except ValidationError as error:
            raise AIOutputError("Groq returned an invalid assessment question.") from error
        except (APIConnectionError, APITimeoutError, APIStatusError) as error:
            raise AIServiceError("Groq is unavailable for question generation.") from error

    def _strict_completion(self, model: str, name: str, schema: dict, prompt: str) -> dict:
        response = None
        failed_generation = ""
        for attempt in range(3):
            retry_instruction = (
                "\nThe previous attempt was rejected as malformed JSON. Retry once with concise strings, "
                "no double-quote characters inside string values, and exactly one syntactically valid JSON object. "
                "Repair this previous output without adding new claims:\n" + failed_generation
                if attempt else ""
            )
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": ROADMAP_SYSTEM_PROMPT},
                        {"role": "user", "content": prompt + retry_instruction},
                    ],
                    temperature=0,
                    reasoning_effort="low",
                    reasoning_format="hidden",
                    max_completion_tokens=8192,
                    response_format=(
                        {"type": "json_object"}
                        if attempt == 2
                        else {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}}
                    ),
                )
                break
            except BadRequestError as error:
                provider_error = error.body.get("error", error.body) if isinstance(error.body, dict) else {}
                retryable = provider_error.get("code") == "json_validate_failed" and bool(provider_error.get("failed_generation"))
                if not retryable or attempt == 2:
                    raise
                failed_generation = str(provider_error["failed_generation"])
        assert response is not None
        content = response.choices[0].message.content
        if not content:
            raise AIOutputError("Groq returned an empty structured response.")
        value = json.loads(content)
        if not isinstance(value, dict):
            raise AIOutputError("Groq returned a non-object structured response.")
        return value
