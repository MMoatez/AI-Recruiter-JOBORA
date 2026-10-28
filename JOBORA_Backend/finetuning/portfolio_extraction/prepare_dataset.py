from __future__ import annotations

import argparse
import json
import random
from collections import defaultdict
from pathlib import Path
from typing import Any

from prompt_templates import SCHEMAS, SECTIONS, system_prompt


ROOT = Path(__file__).resolve().parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prépare le dataset de fine-tuning Portfolio.")
    parser.add_argument("--input", type=Path, default=ROOT / "data" / "train.annotations.jsonl")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "prepared")
    parser.add_argument("--validation-ratio", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def require_type(value: Any, template: Any, path: str) -> None:
    if isinstance(template, str):
        if not isinstance(value, str):
            raise ValueError(f"{path} doit être une chaîne")
        return
    if isinstance(template, list):
        if not isinstance(value, list):
            raise ValueError(f"{path} doit être un tableau")
        for index, item in enumerate(value):
            require_type(item, template[0], f"{path}[{index}]")
        return
    if not isinstance(value, dict):
        raise ValueError(f"{path} doit être un objet")
    if set(value) != set(template):
        missing = sorted(set(template) - set(value))
        extra = sorted(set(value) - set(template))
        raise ValueError(f"{path} possède des clés invalides (manquantes={missing}, supplémentaires={extra})")
    for key, child_template in template.items():
        require_type(value[key], child_template, f"{path}.{key}")


def load_annotations(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as error:
                raise ValueError(f"JSON invalide à la ligne {line_number}: {error}") from error
            section = row.get("section")
            if section not in SECTIONS:
                raise ValueError(f"Ligne {line_number}: section invalide {section!r}")
            if not isinstance(row.get("cv_id"), str) or not row["cv_id"].strip():
                raise ValueError(f"Ligne {line_number}: cv_id obligatoire")
            if not isinstance(row.get("cv_text"), str) or len(row["cv_text"].strip()) < 40:
                raise ValueError(f"Ligne {line_number}: cv_text trop court")
            require_type(row.get("output"), SCHEMAS[section], f"ligne {line_number}.output")
            rows.append(row)
    if not rows:
        raise ValueError("Le dataset est vide")
    return rows


def as_training_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "prompt": [
            {"role": "system", "content": system_prompt(row["section"])},
            {"role": "user", "content": row["cv_text"].strip()},
        ],
        "completion": [{
            "role": "assistant",
            "content": json.dumps(row["output"], ensure_ascii=False, separators=(",", ":")),
        }],
    }


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    args = parse_args()
    if not 0 < args.validation_ratio < 1:
        raise ValueError("validation-ratio doit être compris entre 0 et 1")
    annotations = load_annotations(args.input)
    by_cv: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in annotations:
        by_cv[row["cv_id"]].append(row)
    if len(by_cv) < 2:
        raise ValueError("Au moins deux CV distincts sont nécessaires pour séparer entraînement et validation")

    cv_ids = sorted(by_cv)
    random.Random(args.seed).shuffle(cv_ids)
    validation_count = min(len(cv_ids) - 1, max(1, round(len(cv_ids) * args.validation_ratio)))
    validation_ids = set(cv_ids[:validation_count])
    train_rows = [as_training_row(row) for cv_id in cv_ids if cv_id not in validation_ids for row in by_cv[cv_id]]
    validation_rows = [as_training_row(row) for cv_id in cv_ids if cv_id in validation_ids for row in by_cv[cv_id]]
    write_jsonl(args.output_dir / "train.jsonl", train_rows)
    write_jsonl(args.output_dir / "validation.jsonl", validation_rows)
    print(json.dumps({
        "cv_count": len(cv_ids), "train_examples": len(train_rows),
        "validation_examples": len(validation_rows), "validation_cv_ids": sorted(validation_ids),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
