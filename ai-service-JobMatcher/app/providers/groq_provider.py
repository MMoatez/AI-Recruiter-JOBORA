"""Groq adapter (OpenAI-compatible chat completions) behind the Provider interface.

Logs contain event names, HTTP statuses and attempt counts only: never the API
key, never prompts, never CV content.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Callable

import httpx
from pydantic import BaseModel, ValidationError

from ..config import Settings
from .base import (
    Provider,
    ProviderAuthError,
    ProviderError,
    ProviderNotConfiguredError,
    ProviderRateLimitError,
    ProviderRequestError,
    ProviderResponseError,
    ProviderTimeoutError,
    ProviderUnavailableError,
    T,
)

logger = logging.getLogger("job_matcher.provider")

_MAX_ERROR_CHARS = 200


class GroqProvider(Provider):
    """Talks to Groq's OpenAI-compatible `/chat/completions` endpoint in JSON mode."""

    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.BaseTransport | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._settings = settings
        self._sleep = sleep
        self._client = httpx.Client(
            base_url=settings.groq_base_url,
            headers={"Authorization": f"Bearer {settings.groq_api_key}"} if settings.groq_api_key else {},
            timeout=httpx.Timeout(settings.groq_timeout_seconds),
            transport=transport,
        )

    @property
    def is_configured(self) -> bool:
        return bool(self._settings.groq_api_key and self._settings.groq_model)

    def complete_json(self, system: str, user: str, schema: type[T]) -> T:
        if not self.is_configured:
            raise ProviderNotConfiguredError("The AI provider is not configured on this service.")

        max_attempts = 1 + self._settings.groq_max_retries
        system_prompt = (
            f"{system}\n\n"
            "Return ONLY a raw JSON object (no markdown, no commentary) that validates "
            f"against this JSON Schema:\n{json.dumps(schema.model_json_schema(), ensure_ascii=False)}"
        )
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user},
        ]
        last_error: ProviderError | None = None

        for attempt in range(max_attempts):
            if attempt:
                self._sleep(min(0.5 * (2 ** (attempt - 1)), 4.0))
            try:
                response = self._client.post(
                    "/chat/completions",
                    json={
                        "model": self._settings.groq_model,
                        "messages": messages,
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                    },
                )
            except httpx.TimeoutException:
                last_error = ProviderTimeoutError("The AI provider timed out.")
                logger.warning("provider_timeout attempt=%s", attempt + 1)
                continue
            except httpx.TransportError:
                last_error = ProviderUnavailableError("The AI provider could not be reached.")
                logger.warning("provider_network_error attempt=%s", attempt + 1)
                continue

            status = response.status_code
            if status in (401, 403):
                logger.warning("provider_auth_error status=%s", status)
                raise ProviderAuthError("The AI provider rejected the service credentials.")
            if status == 429:
                last_error = ProviderRateLimitError("The AI provider rate limit was reached.")
                logger.warning("provider_rate_limited attempt=%s", attempt + 1)
                continue
            if status >= 500:
                last_error = ProviderUnavailableError("The AI provider is temporarily unavailable.")
                logger.warning("provider_server_error status=%s attempt=%s", status, attempt + 1)
                continue
            if status != 200:
                detail = _safe_error_detail(response)
                logger.warning("provider_request_rejected status=%s", status)
                raise ProviderRequestError(
                    f"The AI provider rejected the request ({status})"
                    + (f": {detail}" if detail else ".")
                )

            try:
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
            except (ValueError, KeyError, IndexError, TypeError) as error:
                logger.warning("provider_malformed_payload attempt=%s", attempt + 1)
                raise ProviderResponseError("The AI provider returned an unreadable payload.") from error

            try:
                return schema.model_validate_json(content)
            except (ValidationError, ValueError) as error:
                logger.warning("provider_schema_mismatch attempt=%s", attempt + 1)
                raise ProviderResponseError(
                    "The AI provider returned content that does not match the expected structure."
                ) from error

        assert last_error is not None
        raise last_error

    def close(self) -> None:
        self._client.close()


def _safe_error_detail(response: httpx.Response) -> str:
    """Extract a short, non-sensitive error message from a provider response."""
    try:
        payload = response.json()
    except ValueError:
        return ""
    message = payload.get("error") if isinstance(payload, dict) else None
    if isinstance(message, dict):
        message = message.get("message")
    if not isinstance(message, str):
        return ""
    return message[:_MAX_ERROR_CHARS]
