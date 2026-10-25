import numpy as np

from app.schemas import CandidateSkillInput
from app.skill_analysis import SkillGapAnalyzer


class FakeEmbeddingModel:
    vectors = {
        "Flutter": [1.0, 0.0, 0.0, 0.0],
        "Firebase": [0.0, 1.0, 0.0, 0.0],
        "Git": [0.0, 0.0, 1.0, 0.0],
        "Docker": [0.0, 0.0, 0.0, 1.0],
    }

    def encode(self, values, normalize_embeddings=True):
        return np.array([self.vectors.get(value, [0.25, 0.25, 0.25, 0.25]) for value in values])


def test_flutter_firebase_git_docker_gap_analysis(monkeypatch):
    monkeypatch.setattr("app.skill_analysis.load_embedding_model", lambda _: FakeEmbeddingModel())
    analyzer = SkillGapAnalyzer("test-model")
    gaps = analyzer.analyze(
        [
            CandidateSkillInput(name="Flutter", level="intermediate", evidence=["Built a mobile prototype"]),
            CandidateSkillInput(name="Git", level="beginner", evidence=[]),
        ],
        None,
        """Flutter is required for this role.
        Firebase is mandatory for backend integration.
        Git is required for team delivery.
        Docker knowledge is preferred.""",
    )
    by_skill = {gap.skill: gap for gap in gaps}
    assert by_skill["Flutter"].status == "matched"
    assert by_skill["Git"].status == "weakly_evidenced"
    assert by_skill["Firebase"].status == "missing"
    assert by_skill["Docker"].importance == "preferred"
    assert by_skill["Firebase"].priority > by_skill["Docker"].priority


def test_semantic_similarity_never_proves_skill(monkeypatch):
    class SimilarModel:
        def encode(self, values, normalize_embeddings=True):
            return np.ones((len(values), 2)) / np.sqrt(2)

    monkeypatch.setattr("app.skill_analysis.load_embedding_model", lambda _: SimilarModel())
    gaps = SkillGapAnalyzer("test-model").analyze(
        [CandidateSkillInput(name="Container platforms")],
        None,
        "Docker is required.",
    )
    assert gaps[0].status == "partial"
    assert "does not prove" in gaps[0].reasoning
