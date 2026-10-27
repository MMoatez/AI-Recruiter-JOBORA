"""Ranking helpers.

Ordering is fully deterministic: higher compatibility first, then job_id
ascending as a stable tie-break, so identical inputs always produce the same
ranking across runs and processes.
"""

from __future__ import annotations

from .schemas import MatchResult


def sort_key(result: MatchResult) -> tuple[int, str]:
    return (-result.compatibility_score, result.job_id)


def rank_results(results: list[MatchResult], top_n: int) -> list[MatchResult]:
    return sorted(results, key=sort_key)[:top_n]


def shortlist(scored_scores: dict[str, int | None], limit: int) -> list[str]:
    """Job ids ordered by score desc, unscored last, job_id asc within ties."""
    ordered = sorted(
        scored_scores.items(),
        key=lambda item: (-(item[1] if item[1] is not None else -1), item[0]),
    )
    return [job_id for job_id, score in ordered if score is not None][:limit]
