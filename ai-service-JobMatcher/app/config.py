from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

SERVICE_ROOT = Path(__file__).resolve().parents[1]


def _load_env_file(path: Path) -> None:
    """Load a small local .env file without adding another dependency."""
    if not path.exists():
        return
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(SERVICE_ROOT / ".env")

DEFAULT_WEIGHTS: dict[str, float] = {
    "required_skills": 0.40,
    "preferred_skills": 0.15,
    "experience": 0.20,
    "seniority": 0.10,
    "semantic_fit": 0.15,
}


def _weight(name: str, default: float) -> float:
    raw = os.getenv(f"JOB_MATCHER_WEIGHT_{name.upper()}", "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError as error:
        raise ValueError(f"JOB_MATCHER_WEIGHT_{name.upper()} must be a number") from error
    if value < 0:
        raise ValueError(f"JOB_MATCHER_WEIGHT_{name.upper()} must be >= 0")
    return value


def _positive_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError as error:
        raise ValueError(f"{name} must be an integer") from error
    if value < 1:
        raise ValueError(f"{name} must be >= 1")
    return value


@dataclass(frozen=True)
class Settings:
    environment: str
    host: str
    port: int
    internal_token: str = field(repr=False)
    groq_api_key: str = field(repr=False, default="")
    groq_model: str = "openai/gpt-oss-20b"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_timeout_seconds: float = 60.0
    groq_max_retries: int = 2
    weights: dict[str, float] = field(default_factory=dict)
    explain_top_n: int = 10
    max_jobs: int = 200
    max_cv_chars: int = 30000
    experience_tolerance_years: float = 1.0
    min_cv_chars: int = 20

    @property
    def normalized_weights(self) -> dict[str, float]:
        """Weights renormalized so unknown components never distort the scale."""
        total = sum(self.weights.values())
        if total <= 0:
            raise ValueError("Scoring weights must sum to a positive value")
        return {name: value / total for name, value in self.weights.items()}


def get_settings() -> Settings:
    timeout = float(os.getenv("GROQ_TIMEOUT_SECONDS", "60") or 60)
    if timeout <= 0 or timeout > 300:
        raise ValueError("GROQ_TIMEOUT_SECONDS must be between 0 and 300")

    weights = {
        name: _weight(name, default)
        for name, default in DEFAULT_WEIGHTS.items()
    }
    if sum(weights.values()) <= 0:
        raise ValueError("At least one scoring weight must be positive")

    tolerance = float(os.getenv("JOB_MATCHER_EXPERIENCE_TOLERANCE", "1") or 1)
    if tolerance < 0:
        raise ValueError("JOB_MATCHER_EXPERIENCE_TOLERANCE must be >= 0")

    return Settings(
        environment=os.getenv("JOB_MATCHER_ENV", os.getenv("AI_RECRUITER_ENV", "development")),
        host=os.getenv("JOB_MATCHER_HOST", "127.0.0.1"),
        port=_positive_int("JOB_MATCHER_PORT", 8010),
        # Falls back to the training service secret so one local token can be shared.
        internal_token=(
            os.getenv("JOB_MATCHER_INTERNAL_TOKEN", "").strip()
            or os.getenv("TRAINING_AI_INTERNAL_TOKEN", "").strip()
        ),
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        groq_model=os.getenv("GROQ_MODEL_JOB_MATCHER", "openai/gpt-oss-20b").strip()
        or "openai/gpt-oss-20b",
        groq_base_url=os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1").strip().rstrip("/"),
        groq_timeout_seconds=timeout,
        groq_max_retries=_positive_int("GROQ_MAX_RETRIES", 2) - 1,  # extra attempts after the first
        weights=weights,
        explain_top_n=_positive_int("JOB_MATCHER_EXPLAIN_TOP_N", 10),
        max_jobs=_positive_int("JOB_MATCHER_MAX_JOBS", 200),
        max_cv_chars=_positive_int("JOB_MATCHER_MAX_CV_CHARS", 30000),
        experience_tolerance_years=tolerance,
        min_cv_chars=_positive_int("JOB_MATCHER_MIN_CV_CHARS", 20),
    )
