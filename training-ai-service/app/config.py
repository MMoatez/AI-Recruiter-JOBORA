from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]


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


_load_env_file(BACKEND_ROOT / ".env")


@dataclass(frozen=True)
class Settings:
    environment: str
    database_path: Path
    cors_origins: tuple[str, ...]
    groq_api_key: str = field(repr=False)
    groq_model: str
    groq_timeout_seconds: float
    sentence_transformer_model: str
    local_demo_only: bool
    use_finetuned_embeddings: bool
    finetuned_checkpoint: Path
    internal_token: str = field(repr=False)


def get_settings() -> Settings:
    database_value = os.getenv("AI_RECRUITER_DATABASE_PATH", "./data/training.db")
    database_path = Path(database_value)
    if not database_path.is_absolute():
        database_path = (BACKEND_ROOT / database_path).resolve()

    origins = tuple(
        origin.strip().rstrip("/")
        for origin in os.getenv(
            "AI_RECRUITER_CORS_ORIGINS",
            "http://localhost:8443,http://127.0.0.1:8443",
        ).split(",")
        if origin.strip()
    )
    timeout = float(os.getenv("GROQ_TIMEOUT_SECONDS", "60"))
    if timeout <= 0 or timeout > 180:
        raise ValueError("GROQ_TIMEOUT_SECONDS must be between 0 and 180")

    checkpoint_value = Path(os.getenv("AI_RECRUITER_FINETUNED_CHECKPOINT", "./training_experiments/artifacts/model"))
    if not checkpoint_value.is_absolute():
        checkpoint_value = (BACKEND_ROOT / checkpoint_value).resolve()
    return Settings(
        environment=os.getenv("AI_RECRUITER_ENV", "development"),
        database_path=database_path,
        cors_origins=origins,
        groq_api_key=os.getenv("GROQ_API_KEY", "").strip(),
        groq_model=os.getenv("GROQ_MODEL", "openai/gpt-oss-20b").strip(),
        groq_timeout_seconds=timeout,
        sentence_transformer_model=os.getenv(
            "SENTENCE_TRANSFORMER_MODEL",
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
        ).strip(),
        local_demo_only=os.getenv("AI_RECRUITER_LOCAL_DEMO_ONLY", "true").lower() in {"1", "true", "yes"},
        use_finetuned_embeddings=os.getenv("AI_RECRUITER_USE_FINETUNED_EMBEDDINGS", "false").lower() in {"1", "true", "yes"},
        finetuned_checkpoint=checkpoint_value,
        internal_token=os.getenv("TRAINING_AI_INTERNAL_TOKEN", "").strip(),
    )
