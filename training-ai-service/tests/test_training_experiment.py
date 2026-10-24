from pathlib import Path

import numpy as np

from app.schemas import CandidateSkillInput
from app.skill_analysis import EmbeddingServiceError, SkillGapAnalyzer, select_embedding_model
from training_experiments.dataset import leakage_report, load_pairs, split_pairs
from training_experiments.run_experiment import choose_thresholds, metrics


DATASET = Path(__file__).parents[1] / "training_experiments" / "skill_pairs.csv"
DATASET_V2 = Path(__file__).parents[1] / "training_experiments" / "skill_pairs_v2.csv"


def test_dataset_labels_and_family_splits_are_valid():
    pairs = load_pairs(DATASET)
    assert {pair.label for pair in pairs} == {0.0, 0.5, 1.0}
    leakage = leakage_report(pairs)
    assert leakage["family_overlap"] == []
    assert leakage["duplicate_pair_overlap"] == []
    assert leakage["near_duplicate_overlap"] == []
    assert leakage["shared_phrase_overlap"] == ["java", "javascript"]
    assert {key: len(value) for key, value in split_pairs(pairs, 42).items()} == {
        "train": 28, "validation": 8, "test": 12,
    }


def test_split_shuffle_is_reproducible():
    pairs = load_pairs(DATASET)
    first = split_pairs(pairs, 42)
    second = split_pairs(pairs, 42)
    assert first == second


def test_v2_dataset_is_larger_family_disjoint_and_balanced():
    pairs = load_pairs(DATASET_V2)
    splits = split_pairs(pairs, 42)
    assert {key: len(value) for key, value in splits.items()} == {"train": 40, "validation": 20, "test": 20}
    assert not any(leakage_report(pairs).values())
    for values in splits.values():
        counts = {label: sum(pair.label == label for pair in values) for label in (0.0, 0.5, 1.0)}
        assert counts[1.0] == counts[0.0] * 2
        assert counts[0.5] == counts[0.0]


def test_thresholds_are_selected_and_partial_is_separate():
    labels = np.array([0.0, 0.5, 1.0, 1.0])
    scores = np.array([0.1, 0.55, 0.82, 0.9])
    lower, upper = choose_thresholds(labels, scores)
    result = metrics([
        type("Pair", (), {"label": float(label)})() for label in labels
    ], scores, lower, upper)
    assert lower < upper
    assert result["confusion_matrix_rows_true_cols_predicted"] == [[1, 0, 0], [0, 1, 0], [0, 0, 2]]


def test_model_selection_defaults_and_missing_checkpoint_fallback(tmp_path):
    baseline = "sentence-transformers/baseline"
    assert select_embedding_model(baseline, False, str(tmp_path))[1] == "baseline"
    model, source, reason = select_embedding_model(baseline, True, str(tmp_path / "missing"))
    assert model == baseline
    assert source == "baseline_fallback"
    assert reason


def test_incompatible_enabled_checkpoint_falls_back_during_model_load(monkeypatch):
    baseline_model = type("Model", (), {"encode": lambda self, values, normalize_embeddings=True: np.ones((len(values), 2))})()
    def fake_load(name):
        if name == "broken-checkpoint":
            raise EmbeddingServiceError("incompatible")
        return baseline_model
    monkeypatch.setattr("app.skill_analysis.load_embedding_model", fake_load)
    gaps = SkillGapAnalyzer("broken-checkpoint", "baseline").analyze(
        [CandidateSkillInput(name="Container platforms")], None, "Docker is required."
    )
    assert len(gaps) == 1


def test_important_negative_pairs_are_present():
    pairs = load_pairs(DATASET)
    negative_pairs = {(p.text_a, p.text_b) for p in pairs if p.label == 0.0}
    assert ("Java", "JavaScript") in negative_pairs
    assert ("Docker", "Kubernetes") in negative_pairs
    assert any(p.text_a == "Git" and p.text_b == "GitHub" and p.label == 0.5 for p in pairs)
