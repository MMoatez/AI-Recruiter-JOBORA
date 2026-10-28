from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from prepare_dataset import load_annotations
from prompt_templates import SECTIONS


ROOT = Path(__file__).resolve().parent


def summarize(rows: list[dict[str, Any]]) -> dict[str, Any]:
    by_cv: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_cv[row["cv_id"]].append(row)
    invalid_section_sets = {
        cv_id: sorted(item["section"] for item in values)
        for cv_id, values in by_cv.items()
        if Counter(item["section"] for item in values) != Counter(SECTIONS)
    }
    texts = [row["cv_text"] for row in rows if row["section"] == "identity"]
    return {
        "cvs": len(by_cv),
        "examples": len(rows),
        "sections": dict(sorted(Counter(row["section"] for row in rows).items())),
        "invalid_section_sets": invalid_section_sets,
        "duplicate_cv_texts": len(texts) - len(set(texts)),
        "average_cv_characters": round(sum(map(len, texts)) / len(texts), 1) if texts else 0,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audite les datasets annotés du Portfolio.")
    parser.add_argument("--train", type=Path, default=ROOT / "data" / "train.annotations.jsonl")
    parser.add_argument("--test", type=Path, default=ROOT / "data" / "test.annotations.jsonl")
    args = parser.parse_args()
    train = load_annotations(args.train)
    test = load_annotations(args.test)
    train_ids = {row["cv_id"] for row in train}
    test_ids = {row["cv_id"] for row in test}
    train_texts = {row["cv_text"] for row in train}
    test_texts = {row["cv_text"] for row in test}
    report = {
        "train": summarize(train),
        "test": summarize(test),
        "cv_id_leakage": sorted(train_ids & test_ids),
        "cv_text_leakage_count": len(train_texts & test_texts),
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    problems = (
        report["train"]["invalid_section_sets"]
        or report["test"]["invalid_section_sets"]
        or report["cv_id_leakage"]
        or report["cv_text_leakage_count"]
        or report["train"]["duplicate_cv_texts"]
        or report["test"]["duplicate_cv_texts"]
    )
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
