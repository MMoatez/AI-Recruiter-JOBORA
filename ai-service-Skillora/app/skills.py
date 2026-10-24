import json
import re
from pathlib import Path

_SKILLS_PATH = Path(__file__).resolve().parent.parent / "skills.json"
SKILLS: dict[str, list[str]] = json.loads(_SKILLS_PATH.read_text(encoding="utf-8"))

# Un motif par compétence : le mot doit être isolé (pas "git" dans "digital")
_PATTERNS: dict[str, re.Pattern] = {}
for canon, variants in SKILLS.items():
    alternatives = "|".join(re.escape(v) for v in sorted(variants, key=len, reverse=True))
    _PATTERNS[canon] = re.compile(rf"(?<!\w)(?:{alternatives})(?![\w+#])", re.IGNORECASE)


def extract_skills(text: str) -> list[str]:
    return sorted(canon for canon, pat in _PATTERNS.items() if pat.search(text))