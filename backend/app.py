from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

from agent import run_agent_stream
from config import (
    AVAILABLE_CHAT_MODELS,
    AVAILABLE_EMBED_MODELS,
    DEFAULT_CHAT_MODEL,
    DEFAULT_EMBED_MODEL,
    DEFAULT_KB_DIR,
    MAX_FILE_BYTES,
    NVIDIA_BASE_URL,
    RAG_MIN_SCORE,
    RAG_TOP_K,
)
from kb import (
    Embedder,
    KnowledgeBase,
    collect_files,
    read_file_bytes,
    read_file_content,
)
from tools import run_shell, shell_history

# Initialize app
app = FastAPI(title="AI Security Agent API", version="1.0.0")

# CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Knowledge Base instance
kb_instance: Optional[KnowledgeBase] = None
current_embed_model: str = DEFAULT_EMBED_MODEL


def get_kb(api_key: Optional[str] = None, embed_model: Optional[str] = None) -> KnowledgeBase:
    """Get or initialize global KnowledgeBase."""
    global kb_instance, current_embed_model

    key = api_key or os.environ.get("NVIDIA_API_KEY", "")
    target_embed_model = embed_model or current_embed_model

    if kb_instance is None:
        embedder = Embedder(api_key=key, model=target_embed_model) if key else None
        kb_instance = KnowledgeBase(store_dir=DEFAULT_KB_DIR, embedder=embedder)
        current_embed_model = target_embed_model
    else:
        if key and (kb_instance.embedder is None or kb_instance.embedder.api_key != key or target_embed_model != current_embed_model):
            kb_instance.set_embedder(Embedder(api_key=key, model=target_embed_model))
            current_embed_model = target_embed_model

    return kb_instance


# --------------------------------------------------------------------------- #
# Request / Response Models
# --------------------------------------------------------------------------- #

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict[str, Any]]] = []
    model: Optional[str] = DEFAULT_CHAT_MODEL
    embed_model: Optional[str] = DEFAULT_EMBED_MODEL
    rag_enabled: Optional[bool] = True
    rag_min_score: Optional[float] = RAG_MIN_SCORE
    temperature: Optional[float] = 0.7
    api_key: Optional[str] = None
    base_url: Optional[str] = NVIDIA_BASE_URL


class IndexPathRequest(BaseModel):
    path: str
    api_key: Optional[str] = None
    embed_model: Optional[str] = DEFAULT_EMBED_MODEL


class DropRequest(BaseModel):
    source: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    k: Optional[int] = RAG_TOP_K
    api_key: Optional[str] = None
    embed_model: Optional[str] = DEFAULT_EMBED_MODEL


class ShellExecRequest(BaseModel):
    command: str
    timeout: Optional[int] = 60


# --------------------------------------------------------------------------- #
# Endpoints
# --------------------------------------------------------------------------- #

@app.get("/api/health")
async def health():
    kb = get_kb()
    has_api_key = bool(os.environ.get("NVIDIA_API_KEY"))
    return {
        "status": "online",
        "has_api_key": has_api_key,
        "kb_chunks": len(kb),
        "kb_sources": len(kb.sources()),
        "current_embed_model": current_embed_model
    }


@app.get("/api/models")
async def get_models():
    return {
        "chat_models": AVAILABLE_CHAT_MODELS,
        "embed_models": AVAILABLE_EMBED_MODELS,
        "default_chat_model": DEFAULT_CHAT_MODEL,
        "default_embed_model": DEFAULT_EMBED_MODEL,
    }


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    kb = get_kb(api_key=req.api_key, embed_model=req.embed_model)

    async def event_generator():
        async for event in run_agent_stream(
            user_input=req.message,
            history=req.history or [],
            kb=kb,
            chat_model=req.model or DEFAULT_CHAT_MODEL,
            api_key=req.api_key,
            base_url=req.base_url or NVIDIA_BASE_URL,
            rag_enabled=req.rag_enabled if req.rag_enabled is not None else True,
            rag_min_score=req.rag_min_score or RAG_MIN_SCORE,
            temperature=req.temperature if req.temperature is not None else 0.7,
        ):
            yield f"data: {event}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/api/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    api_key: Optional[str] = Query(None),
    embed_model: Optional[str] = Query(None),
):
    key = api_key or os.environ.get("NVIDIA_API_KEY")
    if not key:
        raise HTTPException(
            status_code=400,
            detail="NVIDIA_API_KEY is required to embed files. Please provide it in Settings."
        )

    kb = get_kb(api_key=key, embed_model=embed_model)

    indexed = []
    skipped = []

    for file in files:
        try:
            content = await file.read()
            if len(content) > MAX_FILE_BYTES:
                skipped.append({"name": file.filename, "reason": "Exceeds 10MB limit"})
                continue

            text = read_file_bytes(file.filename or "unknown", content)
            if not text or not text.strip():
                skipped.append({"name": file.filename, "reason": "Empty or unsupported format"})
                continue

            chunks_count = kb.add_document(file.filename or "uploaded_file", text, save=False)
            if chunks_count > 0:
                indexed.append({"name": file.filename, "chunks": chunks_count})
            else:
                skipped.append({"name": file.filename, "reason": "No valid text chunks generated"})
        except Exception as e:
            skipped.append({"name": file.filename, "reason": str(e)})

    kb._save()

    return {
        "success": True,
        "indexed": indexed,
        "skipped": skipped,
        "total_chunks": len(kb),
        "total_sources": len(kb.sources())
    }


@app.post("/api/index-path")
async def index_local_path(req: IndexPathRequest):
    key = req.api_key or os.environ.get("NVIDIA_API_KEY")
    if not key:
        raise HTTPException(
            status_code=400,
            detail="NVIDIA_API_KEY is required to embed files. Please provide it in Settings."
        )

    target = Path(os.path.expanduser(req.path)).resolve()
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Path not found: {target}")

    files = collect_files(target)
    if not files:
        return {"success": False, "message": "No supported files found at that path.", "indexed": []}

    kb = get_kb(api_key=key, embed_model=req.embed_model)
    indexed = []
    skipped = []

    for f in files:
        try:
            size = f.stat().st_size
            if size > MAX_FILE_BYTES:
                skipped.append({"name": f.name, "reason": "Exceeds 10MB limit"})
                continue

            text = read_file_content(f)
            if not text or not text.strip():
                skipped.append({"name": f.name, "reason": "Empty or unsupported format"})
                continue

            chunks = kb.add_document(str(f), text, save=False)
            if chunks > 0:
                indexed.append({"name": f.name, "path": str(f), "chunks": chunks})
        except Exception as e:
            skipped.append({"name": f.name, "reason": str(e)})

    kb._save()

    return {
        "success": True,
        "indexed": indexed,
        "skipped": skipped,
        "total_chunks": len(kb),
        "total_sources": len(kb.sources())
    }


@app.get("/api/kb/sources")
async def get_sources():
    kb = get_kb()
    return {
        "sources": kb.sources(),
        "total_chunks": len(kb)
    }


@app.post("/api/kb/drop")
async def drop_source(req: DropRequest):
    kb = get_kb()
    if not req.source:
        kb.clear()
        return {"success": True, "message": "Knowledge base completely cleared."}

    removed = kb.remove_source(req.source)
    return {
        "success": True,
        "removed_chunks": removed,
        "source": req.source,
        "remaining_chunks": len(kb)
    }


@app.post("/api/kb/clear")
async def clear_kb():
    kb = get_kb()
    kb.clear()
    return {"success": True, "message": "Knowledge base cleared."}


@app.post("/api/kb/search")
async def search_kb(req: SearchRequest):
    key = req.api_key or os.environ.get("NVIDIA_API_KEY")
    kb = get_kb(api_key=key, embed_model=req.embed_model)
    if not len(kb):
        return {"hits": [], "message": "Knowledge base is empty."}

    if not key and (kb.embedder is None or not kb.embedder.api_key):
        raise HTTPException(
            status_code=400,
            detail="NVIDIA_API_KEY is required to generate query embeddings."
        )

    hits = kb.search(req.query, k=req.k or RAG_TOP_K)
    return {"hits": hits, "count": len(hits)}


@app.post("/api/shell/exec")
async def exec_shell(req: ShellExecRequest):
    if not req.command or not req.command.strip():
        raise HTTPException(status_code=400, detail="Command cannot be empty.")

    res = run_shell(req.command, timeout=req.timeout or 60)
    return res


@app.get("/api/shell/history")
async def get_shell_history():
    return {"history": list(reversed(shell_history))}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="127.0.0.1", port=port, reload=True)
