from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import numpy as np

from .skill_analysis import EmbeddingServiceError, load_embedding_model


JOB_TAXONOMY = (
    "System Administrator",
    "Database Administrator",
    "Web Developer",
    "Security Analyst",
    "Network Administrator",
    "Data Scientist",
    "DevOps Engineer",
    "Cloud Engineer",
    "Machine Learning Engineer",
    "Software Engineer",
)


def resolve_model_name(baseline_model: str) -> str:
    """Prefer the original trained SBERT artifact when configured or available locally."""
    configured = os.getenv("CV_MATCHING_MODEL_PATH", "").strip()
    if configured:
        model_path = Path(configured).expanduser()
        if not model_path.is_dir():
            raise EmbeddingServiceError("CV_MATCHING_MODEL_PATH must point to a local model directory.")
        return str(model_path.resolve())

    # The original CV-Embed model is bundled with this internal service.
    bundled_model = Path(__file__).resolve().parents[1] / "models" / "cv_matching_sbert"
    if bundled_model.is_dir() and (bundled_model / "modules.json").is_file():
        return str(bundled_model)
    return baseline_model


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    left_norm = float(np.linalg.norm(left))
    right_norm = float(np.linalg.norm(right))
    if not left_norm or not right_norm:
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))


def analyze_resume_match(
    resume_text: str,
    job_description: str,
    baseline_model: str,
    model: Any | None = None,
) -> dict[str, Any]:
    """Compute the analyzer's SBERT cosine score and its fixed taxonomy suggestions."""
    selected_model = resolve_model_name(baseline_model)
    try:
        encoder = model if model is not None else load_embedding_model(selected_model)
    except EmbeddingServiceError:
        raise
    except (OSError, RuntimeError, ValueError) as error:
        raise EmbeddingServiceError("The CV matching sentence-transformer model could not be loaded.") from error

    try:
        vectors = np.asarray(
            encoder.encode([resume_text, job_description, *JOB_TAXONOMY], normalize_embeddings=False),
            dtype=np.float32,
        )
    except Exception as error:
        raise EmbeddingServiceError("The CV matching model could not encode the supplied text.") from error

    if vectors.ndim != 2 or vectors.shape[0] != 2 + len(JOB_TAXONOMY):
        raise EmbeddingServiceError("The CV matching model returned embeddings with an invalid shape.")

    score = max(0.0, min(1.0, _cosine_similarity(vectors[0], vectors[1]))) * 100
    role_matches = [
        {
            "title": title,
            "score": round(max(0.0, min(1.0, _cosine_similarity(vectors[0], vectors[index + 2]))) * 100, 2),
        }
        for index, title in enumerate(JOB_TAXONOMY)
    ]
    role_matches.sort(key=lambda item: (-item["score"], item["title"]))
    return {
        "compatibility_score": round(score, 2),
        "top_job_matches": role_matches[:5],
        "algorithm": "SBERT cosine similarity",
    }
