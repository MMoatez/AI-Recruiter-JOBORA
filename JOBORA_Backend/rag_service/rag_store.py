from __future__ import annotations

import hashlib
import json
import os
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import chromadb
from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
from dotenv import load_dotenv


BACKEND_DIR = Path(__file__).resolve().parents[1]
SERVICE_DIR = Path(__file__).resolve().parent
load_dotenv(BACKEND_DIR / ".env")


def _resolved_path(environment_name: str, default: Path) -> Path:
    configured = os.getenv(environment_name, "").strip()
    if not configured:
        return default.resolve()
    path = Path(configured).expanduser()
    return (path if path.is_absolute() else BACKEND_DIR / path).resolve()


@dataclass(frozen=True)
class KnowledgeChunk:
    id: str
    source: str
    chunk_index: int
    text: str


def split_document(
    source: str,
    text: str,
    max_characters: int = 850,
    overlap: int = 120,
) -> list[KnowledgeChunk]:
    paragraphs = [" ".join(value.split()) for value in text.split("\n\n") if value.strip()]
    raw_chunks: list[str] = []
    current = ""

    def emit() -> None:
        nonlocal current
        clean = current.strip()
        if clean:
            raw_chunks.append(clean)
        current = ""

    for paragraph in paragraphs:
        if len(paragraph) > max_characters:
            emit()
            start = 0
            step = max(1, max_characters - overlap)
            while start < len(paragraph):
                raw_chunks.append(paragraph[start : start + max_characters].strip())
                start += step
            continue

        candidate = f"{current} {paragraph}".strip()
        if current and len(candidate) > max_characters:
            previous = current
            emit()
            tail = previous[-overlap:].lstrip()
            candidate = f"{tail} {paragraph}".strip()
        current = candidate

    emit()
    chunks: list[KnowledgeChunk] = []
    for index, value in enumerate(filter(None, raw_chunks)):
        chunk_id = hashlib.sha256(f"{source}:{index}:{value}".encode("utf-8")).hexdigest()[:24]
        chunks.append(KnowledgeChunk(chunk_id, source, index, value))
    return chunks


class RagStore:
    def __init__(self) -> None:
        self.documents_dir = _resolved_path("RAG_DOCUMENTS_DIR", BACKEND_DIR / "knowledge_base")
        self.persist_dir = _resolved_path("RAG_PERSIST_DIR", SERVICE_DIR / "data" / "chroma")
        self.collection_name = os.getenv("RAG_COLLECTION", "jobora_ats_knowledge").strip()
        self.embedding_model = os.getenv("RAG_EMBEDDING_MODEL", "all-MiniLM-L6-v2").strip()
        self.default_top_k = int(os.getenv("RAG_TOP_K", "5"))
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.manifest_path = self.persist_dir.parent / "index_manifest.json"
        self.client = chromadb.PersistentClient(path=str(self.persist_dir))
        self.embedding_function = DefaultEmbeddingFunction()
        self._lock = threading.RLock()

    def load_documents(self) -> list[dict[str, str]]:
        files = sorted(self.documents_dir.glob("*.txt"))
        documents = [{"source": path.name, "text": path.read_text(encoding="utf-8").strip()} for path in files]
        documents = [document for document in documents if document["text"]]
        if not documents:
            raise RuntimeError(f"No ATS documents found in {self.documents_dir}")
        return documents

    def chunks(self) -> list[KnowledgeChunk]:
        result: list[KnowledgeChunk] = []
        for document in self.load_documents():
            result.extend(split_document(document["source"], document["text"]))
        return result

    def _fingerprint(self) -> str:
        digest = hashlib.sha256()
        digest.update(b"jobora-python-rag-v1")
        digest.update(self.embedding_model.encode("utf-8"))
        for document in self.load_documents():
            digest.update(document["source"].encode("utf-8"))
            digest.update(document["text"].encode("utf-8"))
        return digest.hexdigest()

    def _manifest(self) -> dict[str, Any]:
        try:
            return json.loads(self.manifest_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _collection(self):
        return self.client.get_or_create_collection(
            name=self.collection_name,
            embedding_function=self.embedding_function,
            metadata={"purpose": "JOBORA ATS RAG", "embedding_model": self.embedding_model},
        )

    def ensure_index(self, force: bool = False) -> int:
        with self._lock:
            fingerprint = self._fingerprint()
            collection = self._collection()
            existing_count = collection.count()
            manifest = self._manifest()
            if not force and existing_count > 0 and manifest.get("fingerprint") == fingerprint:
                return existing_count

            try:
                self.client.delete_collection(self.collection_name)
            except Exception:
                pass
            collection = self._collection()
            chunks = self.chunks()
            collection.upsert(
                ids=[chunk.id for chunk in chunks],
                documents=[chunk.text for chunk in chunks],
                metadatas=[{"source": chunk.source, "chunk_index": chunk.chunk_index} for chunk in chunks],
            )
            self.manifest_path.parent.mkdir(parents=True, exist_ok=True)
            self.manifest_path.write_text(
                json.dumps(
                    {
                        "fingerprint": fingerprint,
                        "collection": self.collection_name,
                        "embedding_model": self.embedding_model,
                        "chunks": len(chunks),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            return len(chunks)

    def search(self, query: str, top_k: int | None = None) -> list[dict[str, Any]]:
        clean_query = " ".join(query.split()).strip()[:800]
        if not clean_query:
            return []
        self.ensure_index(False)
        collection = self._collection()
        limit = max(1, min(top_k or self.default_top_k, 10, collection.count()))
        result = collection.query(
            query_texts=[clean_query],
            n_results=limit,
            include=["documents", "metadatas", "distances"],
        )
        ids = (result.get("ids") or [[]])[0]
        documents = (result.get("documents") or [[]])[0]
        metadatas = (result.get("metadatas") or [[]])[0]
        distances = (result.get("distances") or [[]])[0]
        rows: list[dict[str, Any]] = []
        for index, chunk_id in enumerate(ids):
            metadata = metadatas[index] if index < len(metadatas) and metadatas[index] else {}
            distance = float(distances[index]) if index < len(distances) else None
            rows.append(
                {
                    "id": chunk_id,
                    "source": str(metadata.get("source", "unknown")),
                    "text": documents[index] if index < len(documents) else "",
                    "score": None if distance is None else 1.0 / (1.0 + max(0.0, distance)),
                }
            )
        return rows

    def status(self) -> dict[str, Any]:
        try:
            collection = self._collection()
            count = collection.count()
            return {
                "available": True,
                "collection": self.collection_name,
                "chunks": count,
                "embeddingModel": self.embedding_model,
                "persistent": True,
                "indexCurrent": count > 0 and self._manifest().get("fingerprint") == self._fingerprint(),
            }
        except Exception as error:
            return {
                "available": False,
                "collection": self.collection_name,
                "chunks": 0,
                "embeddingModel": self.embedding_model,
                "persistent": True,
                "indexCurrent": False,
                "error": str(error),
            }

    def diagnostic(self) -> dict[str, Any]:
        return {
            **self.status(),
            "documentsDirectory": str(self.documents_dir),
            "persistenceDirectory": str(self.persist_dir),
            "documents": [document["source"] for document in self.load_documents()],
            "chunksPreview": [asdict(chunk) for chunk in self.chunks()[:2]],
        }
