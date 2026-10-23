import json
import math
import re
from pathlib import Path

from .llm import OLLAMA_HOST, OLLAMA_TIMEOUT_SECONDS
import ollama

EMBED_MODEL = "bge-m3"
ROOT = Path(__file__).resolve().parent.parent
KB_DIR = ROOT / "knowledge"
INDEX_PATH = ROOT / "index.json"


def embed(texts: list[str]) -> list[list[float]]:
    return ollama.Client(host=OLLAMA_HOST, timeout=OLLAMA_TIMEOUT_SECONDS).embed(
        model=EMBED_MODEL, input=texts
    )["embeddings"]


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na and nb else 0.0


def chunk_markdown(text: str, source: str) -> list[dict]:
    """Un chunk = une section '## ...' du fichier."""
    chunks = []
    for part in re.split(r"(?m)^## ", text)[1:]:
        title, _, body = part.partition("\n")
        if body.strip():
            chunks.append({
                "source": source,
                "title": title.strip(),
                "text": f"{source} - {title.strip()}\n{body.strip()}",
            })
    return chunks


def build_index() -> None:
    chunks: list[dict] = []
    for f in sorted(KB_DIR.glob("*.md")):
        chunks += chunk_markdown(f.read_text(encoding="utf-8"), f.stem)
    vectors = embed([c["text"] for c in chunks])
    for c, v in zip(chunks, vectors):
        c["vector"] = v
    INDEX_PATH.write_text(json.dumps(chunks), encoding="utf-8")
    print(f"{len(chunks)} chunks indexés dans {INDEX_PATH.name}")


_INDEX: list[dict] | None = None


def _load() -> list[dict]:
    global _INDEX
    if _INDEX is None:
        _INDEX = json.loads(INDEX_PATH.read_text(encoding="utf-8")) if INDEX_PATH.exists() else []
    return _INDEX


def retrieve(query: str, k: int = 3, min_score: float = 0.35) -> list[dict]:
    index = _load()
    if not index:
        return []
    q = embed([query])[0]
    scored = sorted(((cosine(q, c["vector"]), c) for c in index), key=lambda x: -x[0])
    return [c for s, c in scored[:k] if s >= min_score]



def slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def kb_sources() -> set[str]:
    """Noms des technologies qui ont une fiche dans la base."""
    return {c["source"] for c in _load()}


def retrieve_for_skill(skill: str, query: str, exclude: set | None = None, n: int = 2) -> list[dict]:
    """Les n meilleurs passages de la fiche de CETTE compétence (les déjà utilisés passent en dernier)."""
    exclude = exclude or set()
    pool = [c for c in _load()
            if c["source"] == slug(skill) and c["title"] != "Questions d'entretien typiques"]
    if not pool:
        return []
    q = embed([query])[0]
    ranked = sorted(pool, key=lambda c: -cosine(q, c["vector"]))
    fresh = [c for c in ranked if (c["source"], c["title"]) not in exclude]
    reused = [c for c in ranked if (c["source"], c["title"]) in exclude]
    return (fresh + reused)[:n]

if __name__ == "__main__":
    build_index()