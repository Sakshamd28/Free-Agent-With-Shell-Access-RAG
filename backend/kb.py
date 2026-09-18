from __future__ import annotations

import io
import json
import os
from pathlib import Path
from typing import Any, List, Optional, Tuple

import numpy as np

from config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    EMBED_BATCH,
    NVIDIA_BASE_URL,
    RAG_TOP_K,
)

TEXT_EXTENSIONS = {
    ".txt", ".md", ".markdown", ".rst", ".log", ".csv", ".tsv",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".env",
    ".xml", ".html", ".htm", ".css", ".scss",
    ".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".kt", ".scala",
    ".c", ".h", ".cpp", ".hpp", ".cc", ".cs", ".go", ".rs", ".rb",
    ".php", ".pl", ".lua", ".r", ".m", ".swift",
    ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
    ".sql", ".graphql", ".proto", ".tf", ".dockerfile", ".make", ".mk",
}

SUPPORTED_EXTENSIONS = TEXT_EXTENSIONS | {".pdf"}

SKIP_DIRS = {
    ".git", ".hg", ".svn", "node_modules", "__pycache__", ".venv", "venv",
    "env", ".idea", ".vscode", ".mypy_cache", ".pytest_cache", "dist",
    "build", ".next", ".nuxt", "target", ".tox", ".cache",
}


def read_file_content(path: Path) -> Optional[str]:
    """Read file content from filesystem."""
    ext = path.suffix.lower()

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(str(path))
            return "\n\n".join((page.extract_text() or "") for page in reader.pages)
        except Exception as exc:
            print(f"Could not parse PDF {path.name}: {exc}")
            return None

    if ext in TEXT_EXTENSIONS or ext == "":
        try:
            return path.read_text(encoding="utf-8", errors="ignore")
        except Exception as exc:
            print(f"Could not read {path.name}: {exc}")
            return None

    return None


def read_file_bytes(filename: str, content: bytes) -> Optional[str]:
    """Extract text from uploaded in-memory file bytes."""
    ext = Path(filename).suffix.lower()

    if ext == ".pdf":
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(content))
            pages_text = [(page.extract_text() or "") for page in reader.pages]
            return "\n\n".join(pages_text)
        except Exception as exc:
            print(f"Could not parse uploaded PDF {filename}: {exc}")
            return None

    if ext in TEXT_EXTENSIONS or ext == "":
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception as exc:
            print(f"Could not decode text file {filename}: {exc}")
            return None

    return None


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """Split text into overlapping chunks, preferring natural boundaries."""
    text = text.replace("\r\n", "\n").strip()
    if not text:
        return []

    chunks: List[str] = []
    start = 0
    n = len(text)

    while start < n:
        end = min(start + chunk_size, n)

        if end < n:
            window = text[start:end]
            for sep in ("\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "):
                idx = window.rfind(sep)
                if idx >= int(chunk_size * 0.5):
                    end = start + idx + len(sep)
                    break

        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)

        if end >= n:
            break
        start = max(end - overlap, start + 1)

    return chunks


def collect_files(target: Path) -> List[Path]:
    """Collect supported files from a target file or folder."""
    if target.is_file():
        return [target]
    if not target.is_dir():
        return []

    files: List[Path] = []
    for p in sorted(target.rglob("*")):
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS:
            files.append(p)
    return files


class Embedder:
    """Wrapper around NVIDIA NIM / OpenAI-compatible embeddings endpoint."""

    def __init__(self, api_key: str, model: str, base_url: str = NVIDIA_BASE_URL):
        from openai import OpenAI
        self.api_key = api_key
        self.model = model
        self.base_url = base_url
        self.client = OpenAI(base_url=base_url, api_key=api_key)

    def embed(self, texts: List[str], input_type: str = "passage") -> np.ndarray:
        if not texts:
            return np.zeros((0, 0), dtype=np.float32)

        vectors: List[List[float]] = []
        for i in range(0, len(texts), EMBED_BATCH):
            batch = [t if t and t.strip() else " " for t in texts[i : i + EMBED_BATCH]]
            batch = [t[:8000] for t in batch]
            try:
                resp = self.client.embeddings.create(
                    model=self.model,
                    input=batch,
                    extra_body={"input_type": input_type, "truncate": "END"},
                )
            except Exception as e:
                # Fallback if extra_body is rejected by standard OpenAI endpoints
                resp = self.client.embeddings.create(
                    model=self.model,
                    input=batch,
                )
            for item in sorted(resp.data, key=lambda d: d.index):
                vectors.append(item.embedding)

        return np.asarray(vectors, dtype=np.float32)


class KnowledgeBase:
    """Persistent cosine-similarity vector store backed by numpy."""

    def __init__(self, store_dir: Path, embedder: Optional[Embedder] = None):
        self.dir = Path(store_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.vec_path = self.dir / "vectors.npy"
        self.chunk_path = self.dir / "chunks.json"
        self.meta_path = self.dir / "index.json"

        self.embedder = embedder
        self.chunks: List[dict] = []
        self.vectors: Optional[np.ndarray] = None

        self._load()

    def set_embedder(self, embedder: Embedder):
        if self.embedder is None or self.embedder.model != embedder.model or self.embedder.api_key != embedder.api_key:
            self.embedder = embedder
            self._load()

    def _load(self) -> None:
        if not (self.vec_path.exists() and self.chunk_path.exists()):
            self.vectors, self.chunks = None, []
            return
        try:
            meta = (
                json.loads(self.meta_path.read_text("utf-8"))
                if self.meta_path.exists()
                else {}
            )
            stored_model = meta.get("model")
            if self.embedder and stored_model and stored_model != self.embedder.model:
                print(
                    f"Knowledge base model mismatch ('{stored_model}' vs '{self.embedder.model}'). Resetting vectors."
                )
                self.clear()
                return

            self.vectors = np.load(self.vec_path).astype(np.float32)
            self.chunks = json.loads(self.chunk_path.read_text("utf-8"))
            if len(self.chunks) != len(self.vectors):
                raise ValueError("index/metadata length mismatch")
        except Exception as exc:
            print(f"Could not load knowledge base ({exc}); starting fresh.")
            self.vectors, self.chunks = None, []

    def _save(self) -> None:
        if self.vectors is not None and len(self.chunks) > 0:
            np.save(self.vec_path, self.vectors)
            self.chunk_path.write_text(json.dumps(self.chunks, ensure_ascii=False), "utf-8")
            self.meta_path.write_text(
                json.dumps(
                    {
                        "model": self.embedder.model if self.embedder else "unknown",
                        "dim": int(self.vectors.shape[1]) if self.vectors.ndim == 2 else 0,
                        "count": len(self.chunks),
                    }
                ),
                "utf-8",
            )
        else:
            for p in (self.vec_path, self.chunk_path, self.meta_path):
                if p.exists():
                    p.unlink(missing_ok=True)

    def __len__(self) -> int:
        return len(self.chunks)

    def sources(self) -> List[dict]:
        """Return list of sources with chunk counts and size estimations."""
        counts: dict[str, int] = {}
        char_counts: dict[str, int] = {}
        for c in self.chunks:
            s = c["source"]
            counts[s] = counts.get(s, 0) + 1
            char_counts[s] = char_counts.get(s, 0) + len(c.get("text", ""))
        
        result = []
        for src, count in sorted(counts.items()):
            result.append({
                "source": src,
                "filename": Path(src).name,
                "chunks": count,
                "approxChars": char_counts.get(src, 0)
            })
        return result

    def remove_source(self, source: str) -> int:
        if not self.chunks:
            return 0
        keep = [i for i, c in enumerate(self.chunks) if c["source"] != source]
        removed = len(self.chunks) - len(keep)
        if not removed:
            return 0

        self.chunks = [self.chunks[i] for i in keep]
        if self.vectors is not None:
            self.vectors = self.vectors[keep] if keep else None
        self._save()
        return removed

    def clear(self) -> None:
        self.chunks = []
        self.vectors = None
        self._save()

    def add_document(self, source: str, text: str, save: bool = True) -> int:
        """Chunk, embed, and index text under source name."""
        if not self.embedder:
            raise ValueError("No Embedder configured for KnowledgeBase")

        self.remove_source(source)

        pieces = chunk_text(text)
        if not pieces:
            return 0

        vecs = self.embedder.embed(pieces, input_type="passage")
        if vecs.size == 0:
            return 0

        norms = np.linalg.norm(vecs, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        vecs = (vecs / norms).astype(np.float32)

        for i, piece in enumerate(pieces):
            self.chunks.append({"source": source, "chunk": i, "text": piece})

        self.vectors = vecs if self.vectors is None else np.vstack([self.vectors, vecs])

        if save:
            self._save()
        return len(pieces)

    def search(self, query: str, k: int = RAG_TOP_K) -> List[dict]:
        if not self.chunks or self.vectors is None or len(self.vectors) == 0:
            return []
        if not self.embedder:
            return []

        qv = self.embedder.embed([query], input_type="query")
        if qv.size == 0:
            return []

        q = qv[0]
        norm = float(np.linalg.norm(q))
        if norm == 0.0:
            return []
        q = q / norm

        scores = self.vectors @ q
        k = min(k, len(scores))
        order = np.argsort(-scores)[:k]

        results = []
        for i in order:
            idx = int(i)
            hit = dict(self.chunks[idx])
            hit["score"] = float(scores[idx])
            results.append(hit)
        return results
