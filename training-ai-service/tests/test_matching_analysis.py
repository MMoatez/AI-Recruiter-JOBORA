import numpy as np

from app import matching_analysis


class FakeEncoder:
    def encode(self, texts, normalize_embeddings=False):
        vectors = {
            "resume": [1.0, 0.0],
            "job": [0.8, 0.6],
            "System Administrator": [1.0, 0.0],
        }
        return np.asarray([vectors.get(text, [0.0, 1.0]) for text in texts], dtype=np.float32)


def test_analyzer_score_and_top_role_suggestions_are_sbert_cosines(monkeypatch):
    monkeypatch.setattr(matching_analysis, "resolve_model_name", lambda baseline: baseline)

    result = matching_analysis.analyze_resume_match(
        "resume", "job", "test-model", model=FakeEncoder()
    )

    assert result["compatibility_score"] == 80.0
    assert result["algorithm"] == "SBERT cosine similarity"
    assert result["top_job_matches"][0] == {"title": "System Administrator", "score": 100.0}
    assert len(result["top_job_matches"]) == 5
    assert all(0 <= match["score"] <= 100 for match in result["top_job_matches"])


def test_negative_cosine_is_clamped_to_zero(monkeypatch):
    class OppositeEncoder:
        def encode(self, texts, normalize_embeddings=False):
            return np.asarray([[1.0, 0.0], [-1.0, 0.0], *([[0.0, 1.0]] * 10)])

    monkeypatch.setattr(matching_analysis, "resolve_model_name", lambda baseline: baseline)
    result = matching_analysis.analyze_resume_match(
        "resume", "job", "test-model", model=OppositeEncoder()
    )

    assert result["compatibility_score"] == 0.0
