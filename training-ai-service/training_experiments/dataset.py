from __future__ import annotations

import csv
import random
import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path


VALID_LABELS = {0.0, 0.5, 1.0}
VALID_RELATIONS = {"non_equivalent", "partial", "equivalent"}


@dataclass(frozen=True)
class SkillPair:
    split: str
    family: str
    text_a: str
    text_b: str
    label: float
    relation: str
    provenance: str


def load_pairs(path: Path) -> list[SkillPair]:
    with path.open(encoding="utf-8", newline="") as handle:
        pairs = [SkillPair(**{**row, "label": float(row["label"])}) for row in csv.DictReader(handle)]
    if not pairs:
        raise ValueError("Dataset is empty")
    for pair in pairs:
        if pair.split not in {"train", "validation", "test"}:
            raise ValueError(f"Invalid split: {pair.split}")
        if pair.label not in VALID_LABELS or pair.relation not in VALID_RELATIONS:
            raise ValueError("Labels must be 0.0/0.5/1.0 with matching documented relations")
        expected = {0.0: "non_equivalent", 0.5: "partial", 1.0: "equivalent"}[pair.label]
        if pair.relation != expected:
            raise ValueError("Relation and numeric label disagree")
    return pairs


def _normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    return " ".join(re.sub(r"[^a-z0-9+#.]+", " ", value).split())


def leakage_report(pairs: list[SkillPair], near_duplicate_threshold: float = 0.92) -> dict[str, list[str]]:
    family_splits: dict[str, set[str]] = {}
    for pair in pairs:
        family_splits.setdefault(pair.family, set()).add(pair.split)
    leaking = {family: sorted(splits) for family, splits in family_splits.items() if len(splits) > 1}
    duplicate_pairs: dict[tuple[str, str], set[str]] = {}
    for pair in pairs:
        key = tuple(sorted((_normalize(pair.text_a), _normalize(pair.text_b))))
        duplicate_pairs.setdefault(key, set()).add(pair.split)
    duplicates = [" <> ".join(key) for key, splits in duplicate_pairs.items() if len(splits) > 1]
    phrase_splits: dict[str, set[str]] = {}
    for pair in pairs:
        for phrase in (pair.text_a, pair.text_b):
            normalized = _normalize(phrase)
            phrase_splits.setdefault(normalized, set()).add(pair.split)
    shared_phrases = sorted(phrase for phrase, splits in phrase_splits.items() if len(splits) > 1)
    near_duplicates = []
    normalized_pairs = [(pair.split, " | ".join(sorted((_normalize(pair.text_a), _normalize(pair.text_b))))) for pair in pairs]
    for index, (left_split, left) in enumerate(normalized_pairs):
        for right_split, right in normalized_pairs[index + 1:]:
            if left_split != right_split and SequenceMatcher(None, left, right).ratio() >= near_duplicate_threshold:
                near_duplicates.append(f"{left_split}:{left} <> {right_split}:{right}")
    return {"family_overlap": sorted(leaking), "duplicate_pair_overlap": sorted(duplicates),
            "shared_phrase_overlap": shared_phrases, "near_duplicate_overlap": sorted(near_duplicates)}


def split_pairs(pairs: list[SkillPair], seed: int) -> dict[str, list[SkillPair]]:
    result = {name: [pair for pair in pairs if pair.split == name] for name in ("train", "validation", "test")}
    for offset, values in enumerate(result.values()):
        random.Random(seed + offset).shuffle(values)
    return result
