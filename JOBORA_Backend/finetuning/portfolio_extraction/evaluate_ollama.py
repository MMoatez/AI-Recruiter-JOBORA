from __future__ import annotations

import argparse
import json
import os
import urllib.request
from pathlib import Path
from typing import Any

from prepare_dataset import load_annotations
from prompt_templates import system_prompt


ROOT = Path(__file__).resolve().parent


def call_ollama(host: str, model: str, section: str, cv_text: str) -> dict[str, Any]:
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt(section)},
            {"role": "user", "content": cv_text},
        ],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0},
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{host.rstrip('/')}/api/chat",
        data=body,
        headers={"content-type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=180) as response:
        payload = json.load(response)
    return json.loads(payload["message"]["content"])


def main() -> None:
    parser = argparse.ArgumentParser(description="Évalue le modèle d'extraction servi par Ollama.")
    parser.add_argument("--dataset", type=Path, default=ROOT / "data" / "test.annotations.jsonl")
    parser.add_argument(
        "--model",
        default=os.getenv(
            "OLLAMA_PORTFOLIO_EXTRACTION_MODEL",
            os.getenv("OLLAMA_MODEL", "jobora-portfolio-extractor"),
        ),
    )
    parser.add_argument("--host", default=os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434"))
    parser.add_argument("--limit", type=int, default=0, help="Nombre maximal d'exemples (0 = tous).")
    args = parser.parse_args()

    rows = load_annotations(args.dataset)
    if args.limit > 0:
        rows = rows[:args.limit]
    valid_json = exact = field_matches = field_total = 0
    failures: list[dict[str, str]] = []
    for row in rows:
        try:
            predicted = call_ollama(args.host, args.model, row["section"], row["cv_text"])
            valid_json += 1
            exact += predicted == row["output"]
            for key, expected in row["output"].items():
                field_total += 1
                field_matches += predicted.get(key) == expected
        except Exception as error:
            failures.append({"cv_id": row["cv_id"], "section": row["section"], "error": str(error)})
    count = len(rows)
    print(json.dumps({
        "model": args.model,
        "examples": count,
        "json_valid_rate": valid_json / count,
        "exact_match_rate": exact / count,
        "top_level_field_accuracy": field_matches / field_total if field_total else 0,
        "failures": failures,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
