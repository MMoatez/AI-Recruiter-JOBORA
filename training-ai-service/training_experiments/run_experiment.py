from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
import time
from pathlib import Path

import numpy as np
import torch
from sentence_transformers import InputExample, SentenceTransformer, losses
from torch.utils.data import DataLoader

from .dataset import SkillPair, leakage_report, load_pairs, split_pairs


ROOT = Path(__file__).resolve().parent
BASELINE = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"


def seed_everything(seed: int) -> None:
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)


def cosine_scores(model: SentenceTransformer, pairs: list[SkillPair]) -> np.ndarray:
    left = model.encode([p.text_a for p in pairs], normalize_embeddings=True, show_progress_bar=False)
    right = model.encode([p.text_b for p in pairs], normalize_embeddings=True, show_progress_bar=False)
    return np.sum(left * right, axis=1)


def choose_thresholds(labels: np.ndarray, scores: np.ndarray) -> tuple[float, float]:
    best = (-1.0, 0.35, 0.75)
    for lower in np.arange(0.10, 0.81, 0.05):
        for upper in np.arange(lower + 0.05, 0.96, 0.05):
            predicted = np.where(scores >= upper, 2, np.where(scores >= lower, 1, 0))
            truth = np.where(labels == 1, 2, np.where(labels == .5, 1, 0))
            macro = np.mean([_f1_for_class(truth, predicted, cls) for cls in range(3)])
            candidate = (float(macro), float(lower), float(upper))
            if candidate > best: best = candidate
    return best[1], best[2]


def threshold_analysis(labels: np.ndarray, scores: np.ndarray, tolerance: float = 0.01) -> dict[str, object]:
    candidates = []
    truth = np.where(labels == 1, 2, np.where(labels == .5, 1, 0))
    for lower in np.arange(0.05, 0.91, 0.025):
        for upper in np.arange(lower + 0.025, 0.976, 0.025):
            predicted = np.where(scores >= upper, 2, np.where(scores >= lower, 1, 0))
            macro = float(np.mean([_f1_for_class(truth, predicted, cls) for cls in range(3)]))
            candidates.append((macro, float(lower), float(upper)))
    best = max(item[0] for item in candidates)
    near = [item for item in candidates if item[0] >= best - tolerance]
    lower = float(np.median([item[1] for item in near])); upper = float(np.median([item[2] for item in near]))
    return {"partial": lower, "exact": upper, "best_macro_f1": best, "near_optimal_count": len(near),
            "near_optimal_partial_range": [min(item[1] for item in near), max(item[1] for item in near)],
            "near_optimal_exact_range": [min(item[2] for item in near), max(item[2] for item in near)]}


def _f1_for_class(truth: np.ndarray, predicted: np.ndarray, cls: int) -> float:
    tp = int(np.sum((truth == cls) & (predicted == cls)))
    fp = int(np.sum((truth != cls) & (predicted == cls)))
    fn = int(np.sum((truth == cls) & (predicted != cls)))
    return 2 * tp / (2 * tp + fp + fn) if 2 * tp + fp + fn else 0.0


def metrics(pairs: list[SkillPair], scores: np.ndarray, lower: float, upper: float) -> dict[str, object]:
    labels = np.array([p.label for p in pairs])
    truth = np.where(labels == 1, 2, np.where(labels == .5, 1, 0))
    predicted = np.where(scores >= upper, 2, np.where(scores >= lower, 1, 0))
    exact_truth, exact_pred = truth == 2, predicted == 2
    tp = int(np.sum(exact_truth & exact_pred)); fp = int(np.sum(~exact_truth & exact_pred)); fn = int(np.sum(exact_truth & ~exact_pred))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    confusion = [[int(np.sum((truth == row) & (predicted == col))) for col in range(3)] for row in range(3)]
    per_class = {}
    for cls, name in enumerate(("non_equivalent", "partial", "equivalent")):
        class_tp = int(np.sum((truth == cls) & (predicted == cls)))
        class_fp = int(np.sum((truth != cls) & (predicted == cls)))
        class_fn = int(np.sum((truth == cls) & (predicted != cls)))
        class_precision = class_tp / (class_tp + class_fp) if class_tp + class_fp else 0.0
        class_recall = class_tp / (class_tp + class_fn) if class_tp + class_fn else 0.0
        per_class[name] = {"precision": class_precision, "recall": class_recall,
            "f1": _f1_for_class(truth, predicted, cls), "support": int(np.sum(truth == cls))}
    return {"precision_exact": precision, "recall_exact": recall,
            "f1_exact": 2 * precision * recall / (precision + recall) if precision + recall else 0.0,
            "macro_f1_three_class": float(np.mean([_f1_for_class(truth, predicted, cls) for cls in range(3)])),
            "per_class": per_class,
            "confusion_matrix_rows_true_cols_predicted": confusion,
            "similarity_by_relation": {relation: {"mean": float(np.mean(scores[labels == label])), "values": [float(x) for x in scores[labels == label]]}
                for label, relation in ((0.0, "non_equivalent"), (0.5, "partial"), (1.0, "equivalent"))}}


def parameter_digest(model: SentenceTransformer) -> str:
    first = next(model.parameters()).detach().cpu().numpy().tobytes()
    return hashlib.sha256(first).hexdigest()


def train(model: SentenceTransformer, pairs: list[SkillPair], output: Path, epochs: int, batch_size: int, lr: float, seed: int) -> tuple[list[float], bool]:
    examples = [InputExample(texts=[p.text_a, p.text_b], label=p.label) for p in pairs]
    generator = torch.Generator().manual_seed(seed)
    loader = DataLoader(examples, batch_size=batch_size, shuffle=True, generator=generator, collate_fn=model.smart_batching_collate)
    loss_model = losses.CosineSimilarityLoss(model)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr)
    before = parameter_digest(model); epoch_losses = []
    model.train()
    for _ in range(epochs):
        batch_losses = []
        for features, labels in loader:
            optimizer.zero_grad(set_to_none=True)
            loss = loss_model(features, labels)
            loss.backward(); optimizer.step()
            batch_losses.append(float(loss.detach()))
        epoch_losses.append(float(np.mean(batch_losses)))
    changed = before != parameter_digest(model)
    if not changed: raise RuntimeError("Training completed without changing model parameters")
    output.mkdir(parents=True, exist_ok=True); model.save(str(output))
    return epoch_losses, changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=ROOT / "skill_pairs.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts")
    parser.add_argument("--epochs", type=int, default=1); parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--learning-rate", type=float, default=2e-5); parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--smoke", action="store_true", help="Train on the first eight family-safe training pairs.")
    args = parser.parse_args(); seed_everything(args.seed)
    pairs = load_pairs(args.dataset); leakage = leakage_report(pairs)
    if any(leakage.values()): raise ValueError(f"Dataset leakage detected: {leakage}")
    splits = split_pairs(pairs, args.seed); training_pairs = splits["train"][:8] if args.smoke else splits["train"]
    args.output.mkdir(parents=True, exist_ok=True)
    baseline = SentenceTransformer(BASELINE, device="cpu")
    baseline_val = cosine_scores(baseline, splits["validation"]); baseline_thresholds = choose_thresholds(np.array([p.label for p in splits["validation"]]), baseline_val)
    baseline_test = cosine_scores(baseline, splits["test"]); baseline_metrics = metrics(splits["test"], baseline_test, *baseline_thresholds)
    started = time.perf_counter(); epoch_losses, changed = train(baseline, training_pairs, args.output / "model", args.epochs, args.batch_size, args.learning_rate, args.seed)
    duration = time.perf_counter() - started
    tuned = SentenceTransformer(str(args.output / "model"), device="cpu")
    tuned_val = cosine_scores(tuned, splits["validation"]); tuned_thresholds = choose_thresholds(np.array([p.label for p in splits["validation"]]), tuned_val)
    tuned_test = cosine_scores(tuned, splits["test"]); tuned_metrics = metrics(splits["test"], tuned_test, *tuned_thresholds)
    report = {"experiment": "smoke" if args.smoke else "full", "synthetic_data": True, "base_model": BASELINE,
        "weights_updated": changed, "seed": args.seed, "epochs": args.epochs, "batch_size": args.batch_size,
        "learning_rate": args.learning_rate, "duration_seconds": duration, "epoch_training_loss": epoch_losses,
        "split_sizes": {k: len(v) for k, v in splits.items()}, "training_examples_used": len(training_pairs), "leakage": leakage,
        "baseline": {"validation_thresholds": {"partial": baseline_thresholds[0], "exact": baseline_thresholds[1]}, "test": baseline_metrics},
        "fine_tuned": {"validation_thresholds": {"partial": tuned_thresholds[0], "exact": tuned_thresholds[1]}, "test": tuned_metrics}}
    (args.output / "metrics.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    with (args.output / "predictions.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle); writer.writerow(["family", "text_a", "text_b", "label", "baseline_cosine", "fine_tuned_cosine"])
        writer.writerows([[p.family, p.text_a, p.text_b, p.label, float(b), float(t)] for p, b, t in zip(splits["test"], baseline_test, tuned_test)])
    (args.output / "report.md").write_text("# Before/after report\n\nSmall synthetic academic experiment; not empirical production validation.\n\n```json\n" + json.dumps(report, indent=2) + "\n```\n", encoding="utf-8")
    print(json.dumps(report, indent=2)); return 0


if __name__ == "__main__": raise SystemExit(main())
