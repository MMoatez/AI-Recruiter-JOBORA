from __future__ import annotations

from app.ranking import rank_results, shortlist
from app.schemas import MatchResult, ScoreBreakdown, WorkArrangement


def result(job_id: str, score: int) -> MatchResult:
    return MatchResult(
        job_id=job_id,
        job_title=f"Job {job_id}",
        company="Demo",
        location="",
        work_arrangement=WorkArrangement.unknown,
        compatibility_score=score,
        matched_skills=[],
        missing_required_skills=[],
        missing_preferred_skills=[],
        semantic_fit=None,
        reasons=[],
        recommendations=[],
        gaps=[],
        score_breakdown=ScoreBreakdown(applicable_weight_total=0.55),
    )


def test_rank_descending_by_score() -> None:
    ranked = rank_results([result("a", 50), result("b", 90), result("c", 70)], 10)
    assert [r.job_id for r in ranked] == ["b", "c", "a"]


def test_ties_broken_by_job_id_ascending() -> None:
    ranked = rank_results([result("z-1", 70), result("a-2", 70), result("m-3", 70)], 10)
    assert [r.job_id for r in ranked] == ["a-2", "m-3", "z-1"]


def test_ranking_is_repeatable() -> None:
    items = [result("b", 60), result("a", 60), result("c", 61)]
    first = [r.job_id for r in rank_results(items, 10)]
    second = [r.job_id for r in rank_results(list(reversed(items)), 10)]
    assert first == second


def test_top_n_cut() -> None:
    ranked = rank_results([result("a", 99), result("b", 80), result("c", 60)], 2)
    assert len(ranked) == 2
    assert ranked[-1].job_id == "b"


def test_shortlist_orders_scores_and_drops_unscored() -> None:
    ids = shortlist({"a": 50, "b": 90, "c": None, "z": 90, "m": 70}, 3)
    assert ids == ["b", "z", "m"]  # ties by id, unscored excluded
