"""Provider abstraction for the Job Matcher service.

The matching business logic only depends on :class:`Provider`; swapping
Groq for another vendor means implementing this interface in a new module.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TypeVar

from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class ProviderError(Exception):
    """Base class for AI provider failures. Messages are safe to log/return."""

    retryable = False


class ProviderNotConfiguredError(ProviderError):
    """No API key or model configured for the provider."""


class ProviderAuthError(ProviderError):
    """The provider rejected the credentials (HTTP 401/403)."""


class ProviderRateLimitError(ProviderError):
    """The provider rate limit (HTTP 429) persisted after bounded retries."""


class ProviderTimeoutError(ProviderError):
    """The provider did not answer within the configured timeout."""


class ProviderUnavailableError(ProviderError):
    """Network failure or provider 5xx persisted after bounded retries."""


class ProviderRequestError(ProviderError):
    """The provider rejected the request itself (other HTTP 4xx)."""


class ProviderResponseError(ProviderError):
    """The provider answered, but the payload was unusable (malformed JSON or schema violation)."""


class Provider(ABC):
    """Minimal structured-JSON completion interface."""

    @property
    @abstractmethod
    def is_configured(self) -> bool:
        """Whether credentials/model are available (never exposes their values)."""

    @abstractmethod
    def complete_json(self, system: str, user: str, schema: type[T]) -> T:
        """Run one completion and return a validated `schema` instance.

        Raises ProviderError subclasses on every failure mode. Never returns
        partial or fabricated data.
        """
