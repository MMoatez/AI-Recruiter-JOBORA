from __future__ import annotations

from groq import APIConnectionError, APIStatusError, APITimeoutError, Groq

from .config import Settings
from .schemas import AIStatusResponse


def get_groq_status(settings: Settings) -> AIStatusResponse:
    if not settings.groq_api_key:
        return AIStatusResponse(
            available=False,
            configured=False,
            configured_model=settings.groq_model or None,
            live_check_performed=False,
            message="Groq is not configured. Add GROQ_API_KEY to backend/.env.",
        )
    try:
        client = Groq(api_key=settings.groq_api_key, timeout=settings.groq_timeout_seconds, max_retries=0)
        available_models = {model.id for model in client.models.list().data}
        available = settings.groq_model in available_models
        return AIStatusResponse(
            available=available,
            configured=True,
            configured_model=settings.groq_model,
            live_check_performed=True,
            message=(
                "Groq is reachable and the configured model is available."
                if available
                else "Groq is reachable, but the configured model is unavailable."
            ),
        )
    except (APIStatusError, APIConnectionError, APITimeoutError):
        return AIStatusResponse(
            available=False,
            configured=True,
            configured_model=settings.groq_model,
            live_check_performed=True,
            message="Groq configuration could not be verified.",
        )
