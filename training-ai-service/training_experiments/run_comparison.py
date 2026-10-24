from __future__ import annotations

import argparse
import csv
import json
import shutil
import time
from pathlib import Path

import numpy as np
from sentence_transformers import SentenceTransformer

from .dataset import leakage_report, load_pairs, split_pairs
from .run_experiment import BASELINE, cosine_scores, metrics, seed_everything, threshold_analysis, train


ROOT = Path(__file__).resolve().parent
SETTINGS = (
    {"name": "conservative", "epochs": 1, "learning_rate": 5e-6, "batch_size": 8},
    {"name": "moderate", "epochs": 1, "learning_rate": 1e-5, "batch_size": 8},
)
SEEDS = (13, 42)


def main() -> int:
    parser = argparse.ArgumentParser(description="Validation-only model selection followed by one final-test evaluation.")
    parser.add_argument("--dataset", type=Path, default=ROOT / "skill_pairs_v2.csv")
    parser.add_argument("--output", type=Path, default=ROOT / "artifacts_v2")
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError(f"Refusing to overwrite experiment directory: {args.output}")
    args.output.mkdir(parents=True)
    pairs = load_pairs(args.dataset); leakage = leakage_report(pairs)
    if any(leakage.values()): raise ValueError(f"Dataset leakage detected: {leakage}")
    splits = split_pairs(pairs, 0)
    labels_val = np.array([pair.label for pair in splits["validation"]])

    baseline = SentenceTransformer(BASELINE, device="cpu")
    baseline_val_scores = cosine_scores(baseline, splits["validation"])
    baseline_thresholds = threshold_analysis(labels_val, baseline_val_scores)
    baseline_validation = metrics(splits["validation"], baseline_val_scores,
        float(baseline_thresholds["partial"]), float(baseline_thresholds["exact"]))

    candidates = []
    for setting in SETTINGS:
        for seed in SEEDS:
            seed_everything(seed)
            model = SentenceTransformer(BASELINE, device="cpu")
            candidate_dir = args.output / "candidates" / f"{setting['name']}_seed{seed}"
            started = time.perf_counter()
            losses, changed = train(model, splits["train"], candidate_dir, setting["epochs"], setting["batch_size"], setting["learning_rate"], seed)
            duration = time.perf_counter() - started
            validation_scores = cosine_scores(model, splits["validation"])
            thresholds = threshold_analysis(labels_val, validation_scores)
            validation_metrics = metrics(splits["validation"], validation_scores,
                float(thresholds["partial"]), float(thresholds["exact"]))
            candidates.append({**setting, "seed": seed, "weights_updated": changed, "duration_seconds": duration,
                "epoch_training_loss": losses, "checkpoint": str(candidate_dir), "threshold_analysis": thresholds,
                "validation": validation_metrics})

    setting_means = {}
    for setting in SETTINGS:
        values = [candidate["validation"]["macro_f1_three_class"] for candidate in candidates if candidate["name"] == setting["name"]]
        setting_means[setting["name"]] = float(np.mean(values))
    selected_setting = max(setting_means, key=lambda name: (setting_means[name], name))
    eligible = [candidate for candidate in candidates if candidate["name"] == selected_setting]
    selected = min(eligible, key=lambda candidate: abs(candidate["validation"]["macro_f1_three_class"] - setting_means[selected_setting]))

    # The final test is first touched here, after selection is locked from validation results.
    selected_model = SentenceTransformer(selected["checkpoint"], device="cpu")
    baseline_test_scores = cosine_scores(baseline, splits["test"])
    selected_test_scores = cosine_scores(selected_model, splits["test"])
    baseline_test = metrics(splits["test"], baseline_test_scores,
        float(baseline_thresholds["partial"]), float(baseline_thresholds["exact"]))
    selected_test = metrics(splits["test"], selected_test_scores,
        float(selected["threshold_analysis"]["partial"]), float(selected["threshold_analysis"]["exact"]))
    selected_dir = args.output / "selected_model"
    shutil.copytree(selected["checkpoint"], selected_dir)

    result = {"protocol": "v2_validation_only_selection_then_single_final_test", "synthetic_data": True,
        "base_model": BASELINE, "split_sizes": {name: len(values) for name, values in splits.items()},
        "leakage": leakage, "settings": list(SETTINGS), "seeds": list(SEEDS),
        "baseline_validation": baseline_validation, "baseline_threshold_analysis": baseline_thresholds,
        "candidate_validation_results": candidates, "setting_mean_validation_macro_f1": setting_means,
        "selected_candidate": {key: value for key, value in selected.items() if key != "validation"},
        "baseline_final_test": baseline_test, "selected_final_test": selected_test,
        "selected_checkpoint": str(selected_dir),
        "uncertainty": "Small synthetic splits; four candidate runs and two seeds do not support a production-generalization claim."}
    (args.output / "comparison_metrics.json").write_text(json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    with (args.output / "final_test_predictions.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle); writer.writerow(["family", "text_a", "text_b", "label", "baseline_cosine", "selected_cosine"])
        writer.writerows([[p.family, p.text_a, p.text_b, p.label, float(b), float(s)] for p, b, s in zip(splits["test"], baseline_test_scores, selected_test_scores)])
    (args.output / "comparison_report.md").write_text(
        "# V2 comparison report\n\nCandidate selection used validation data only. The final test was evaluated once after selection. "
        "All data is synthetic; results do not establish production validity.\n\n```json\n" + json.dumps(result, indent=2) + "\n```\n", encoding="utf-8")
    print(json.dumps({"selected": selected_dir.name, "selected_setting": selected_setting,
        "baseline_test": baseline_test, "selected_test": selected_test}, indent=2)); return 0


if __name__ == "__main__": raise SystemExit(main())
