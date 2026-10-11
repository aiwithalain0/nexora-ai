import datetime
import json
import logging
import re
from pathlib import Path
from typing import List, Optional

import chromadb
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rag.config import (
    CHUNK_OVERLAP,
    CHUNK_WORDS,
    EMBEDDING_MODEL,
    GROQ_MODEL,
    INDEX_DIR,
    PROCESSED_DATA_DIR,
    PROJECT_ROOT,
    RAW_DATA_DIR,
)
from rag.index import (
    add_document_to_index,
    get_collection_name,
    load_all_chunks_from_file,
    remove_document_from_index,
)
from rag.ingest import SUPPORTED_EXTENSIONS
from rag.pipeline import ask

logger = logging.getLogger("rag_app")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Nexora AI - RAG Knowledge Assistant",
    description="FastAPI Web Interface with Dynamic Document Management and RAG Search",
    version="2.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = PROJECT_ROOT / "static"
RESULTS_DIR = PROJECT_ROOT / "results"
MAX_UPLOAD_SIZE = 25 * 1024 * 1024  # 25 MB max per file


# ── Metadata Tracker ──────────────────────────────────────────

METADATA_FILE = PROJECT_ROOT / "data" / "documents_meta.json"


def load_doc_metadata() -> dict:
    if not METADATA_FILE.exists():
        return {}
    try:
        with METADATA_FILE.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_doc_metadata(meta: dict) -> None:
    METADATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with METADATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)


def sanitize_filename(name: str) -> str:
    """Keep safe alphanumeric characters, dashes, underscores, and dots."""
    clean = Path(name).name
    clean = re.sub(r"[^\w\.\-\s]", "_", clean)
    clean = re.sub(r"\s+", "_", clean).strip("_.")
    return clean or "document"


# ── Request Models ──────────────────────────────────────────────

class QuestionRequest(BaseModel):
    question: str = Field(..., description="The user question to ask the RAG assistant")
    method: str = Field(default="hybrid", description="Retrieval method: 'hybrid', 'vector', or 'bm25'")
    k: int = Field(default=5, description="Number of passages to retrieve", ge=1, le=20)


class DeleteDocRequest(BaseModel):
    filename: str = Field(..., description="The name of the file to remove")


# ── Pages ───────────────────────────────────────────────────────

@app.get("/")
def get_index():
    """Serve the single-page frontend."""
    index_path = STATIC_DIR / "index.html"
    if not index_path.exists():
        raise HTTPException(status_code=404, detail="Frontend index.html not found")
    return FileResponse(index_path)


# ── API: Health ─────────────────────────────────────────────────

@app.get("/api/health")
def health_check():
    """Health check and assistant metadata (no sensitive keys exposed)."""
    index_ready = False
    chunk_count = 0
    try:
        client = chromadb.PersistentClient(path=str(INDEX_DIR))
        collection = client.get_or_create_collection(
            name=get_collection_name(),
            metadata={"hnsw:space": "cosine"},
        )
        chunk_count = collection.count()
        index_ready = chunk_count > 0
    except Exception:
        pass

    return {
        "status": "healthy",
        "index_ready": index_ready,
        "chunk_count": chunk_count,
        "default_method": "hybrid",
        "llm_model": GROQ_MODEL,
        "embedding_model": EMBEDDING_MODEL,
        "available_methods": ["hybrid", "vector", "bm25"],
        "max_upload_size_mb": 25,
        "supported_formats": [ext.lstrip(".").upper() for ext in sorted(SUPPORTED_EXTENSIONS)],
    }


# ── API: Ask ────────────────────────────────────────────────────

@app.post("/api/ask")
def ask_question(payload: QuestionRequest):
    """
    Query the RAG pipeline using the updated ChromaDB index and JSONL BM25 index.
    """
    clean_question = payload.question.strip()
    if not clean_question:
        raise HTTPException(status_code=400, detail="Please enter a valid question.")

    method = payload.method.lower().strip()
    if method not in {"hybrid", "vector", "bm25"}:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid retrieval method '{payload.method}'. Must be 'hybrid', 'vector', or 'bm25'.",
        )

    try:
        result = ask(question=clean_question, method=method, k=payload.k)
        return JSONResponse(content=result)
    except ValueError as ve:
        logger.warning(f"Validation error in RAG ask: {ve}")
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"Error processing question: {exc}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error generating answer: {str(exc)}",
        )


# ── API: Knowledge Base ────────────────────────────────────────

@app.get("/api/knowledge")
def get_knowledge_base():
    """Return live list of managed documents with file size, chunks, and index status."""
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    all_chunks = load_all_chunks_from_file()

    # Map chunks by source document
    chunks_by_source = {}
    pages_by_source = {}
    for c in all_chunks:
        src = c.get("source", "")
        if src:
            chunks_by_source[src] = chunks_by_source.get(src, 0) + 1
            pages_by_source.setdefault(src, set()).add(c.get("page", 1))

    doc_meta = load_doc_metadata()
    documents = []

    # Scan raw data folder
    for file_path in sorted(RAW_DATA_DIR.iterdir()):
        if not file_path.is_file():
            continue
        ext = file_path.suffix.lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue

        filename = file_path.name
        stat = file_path.stat()
        file_size = stat.st_size
        
        # Meta or stat date
        stored_meta = doc_meta.get(filename, {})
        upload_time = stored_meta.get(
            "uploaded_at",
            datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
        )
        status = stored_meta.get("status", "Indexed" if filename in chunks_by_source else "Uploaded")

        chunk_num = chunks_by_source.get(filename, 0)
        page_num = len(pages_by_source.get(filename, set()))

        type_map = {
            ".pdf": "PDF",
            ".docx": "DOCX",
            ".txt": "TXT",
            ".md": "Markdown",
        }

        documents.append({
            "name": filename,
            "type": type_map.get(ext, ext.lstrip(".").upper()),
            "file_size_bytes": file_size,
            "chunks": chunk_num,
            "pages": page_num if page_num > 0 else 1,
            "uploaded_at": upload_time,
            "status": status,
            "indexed": (status == "Indexed" and chunk_num > 0),
        })

    # ChromaDB count
    index_ready = False
    total_vectors = 0
    try:
        client = chromadb.PersistentClient(path=str(INDEX_DIR))
        collection = client.get_or_create_collection(
            name=get_collection_name(),
            metadata={"hnsw:space": "cosine"},
        )
        total_vectors = collection.count()
        index_ready = total_vectors > 0
    except Exception:
        pass

    return {
        "index_ready": index_ready,
        "total_vectors": total_vectors,
        "total_documents": len(documents),
        "embedding_model": EMBEDDING_MODEL,
        "chunk_words": CHUNK_WORDS,
        "chunk_overlap": CHUNK_OVERLAP,
        "documents": documents,
    }


# ── API: Upload Document ────────────────────────────────────────

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """
    Validate, save, and immediately ingest and index an uploaded document.
    Updates ChromaDB, JSONL, and document metadata.
    """
    original_name = file.filename or "uploaded_file"
    safe_name = sanitize_filename(original_name)
    ext = Path(safe_name).suffix.lower()

    if ext not in SUPPORTED_EXTENSIONS:
        supported_str = ", ".join([e.lstrip(".").upper() for e in sorted(SUPPORTED_EXTENSIONS)])
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: {supported_str}.",
        )

    # Read content and validate size
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum size limit of {MAX_UPLOAD_SIZE // (1024*1024)} MB.",
        )

    # Magic byte basic verification
    if ext == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=400, detail="File content does not match standard PDF format.")

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    destination_path = RAW_DATA_DIR / safe_name

    # Save file to managed raw directory
    try:
        with destination_path.open("wb") as f:
            f.write(content)
    except Exception as exc:
        logger.error(f"Failed to write file {safe_name}: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(exc)}")

    # Update metadata status to Processing
    doc_meta = load_doc_metadata()
    now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    doc_meta[safe_name] = {
        "uploaded_at": now_str,
        "status": "Processing",
        "file_size": len(content),
    }
    save_doc_metadata(doc_meta)

    # Trigger automatic ingestion & indexing
    try:
        chunk_count = add_document_to_index(destination_path)
        doc_meta[safe_name]["status"] = "Indexed"
        doc_meta[safe_name]["chunks"] = chunk_count
        save_doc_metadata(doc_meta)

        return {
            "success": True,
            "filename": safe_name,
            "chunks": chunk_count,
            "status": "Indexed",
            "message": f"Successfully ingested and indexed '{safe_name}' ({chunk_count} chunks ready for RAG query).",
        }
    except Exception as exc:
        logger.error(f"Error during document indexing for {safe_name}: {exc}", exc_info=True)
        # Mark as Failed so user knows
        doc_meta[safe_name]["status"] = "Failed"
        doc_meta[safe_name]["error"] = str(exc)
        save_doc_metadata(doc_meta)
        raise HTTPException(
            status_code=422,
            detail=f"File was saved, but indexing failed: {str(exc)}",
        )


# ── API: Delete Document ────────────────────────────────────────

@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    """
    Safely remove a document, purge its chunks from ChromaDB and JSONL,
    and delete the file from the managed storage folder.
    """
    safe_name = sanitize_filename(filename)
    target_path = RAW_DATA_DIR / safe_name

    # Remove chunks from ChromaDB and JSONL
    removed_chunks = remove_document_from_index(safe_name)

    # Remove file from disk
    file_removed = False
    if target_path.exists():
        try:
            target_path.unlink()
            file_removed = True
        except Exception as exc:
            logger.warning(f"Failed to unlink file {target_path}: {exc}")

    # Remove from metadata tracker
    doc_meta = load_doc_metadata()
    if safe_name in doc_meta:
        del doc_meta[safe_name]
        save_doc_metadata(doc_meta)

    return {
        "success": True,
        "filename": safe_name,
        "removed_chunks": removed_chunks,
        "file_removed": file_removed,
        "message": f"Document '{safe_name}' and its {removed_chunks} chunks removed successfully.",
    }


# ── API: Reindex Document ───────────────────────────────────────

@app.post("/api/documents/{filename}/reindex")
def reindex_document(filename: str):
    """Reindex an existing document in the managed storage."""
    safe_name = sanitize_filename(filename)
    target_path = RAW_DATA_DIR / safe_name
    if not target_path.exists():
        raise HTTPException(status_code=404, detail=f"Document '{safe_name}' not found on server.")

    try:
        chunks = add_document_to_index(target_path)
        doc_meta = load_doc_metadata()
        if safe_name not in doc_meta:
            doc_meta[safe_name] = {"uploaded_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M")}
        doc_meta[safe_name]["status"] = "Indexed"
        doc_meta[safe_name]["chunks"] = chunks
        save_doc_metadata(doc_meta)
        return {
            "success": True,
            "filename": safe_name,
            "chunks": chunks,
            "message": f"Successfully reindexed '{safe_name}' ({chunks} chunks).",
        }
    except Exception as exc:
        logger.error(f"Reindex failed for {safe_name}: {exc}")
        raise HTTPException(status_code=500, detail=f"Reindexing failed: {str(exc)}")


# ── API: Evaluation Results ────────────────────────────────────

@app.get("/api/evaluation")
def get_evaluation_results():
    """Return evaluation metrics if results/evaluation.json exists."""
    eval_file = RESULTS_DIR / "evaluation.json"
    if not eval_file.exists():
        return {"available": False, "message": "No evaluation results found. Run the evaluation script first."}

    try:
        with eval_file.open("r", encoding="utf-8") as f:
            raw_results = json.load(f)

        methods = {}
        for row in raw_results:
            m = row["method"]
            if m not in methods:
                methods[m] = {
                    "recall_at_1": [],
                    "recall_at_3": [],
                    "recall_at_5": [],
                    "mrr": [],
                    "latency_ms": [],
                }
            methods[m]["recall_at_1"].append(row["recall_at_1"])
            methods[m]["recall_at_3"].append(row["recall_at_3"])
            methods[m]["recall_at_5"].append(row["recall_at_5"])
            methods[m]["mrr"].append(row["mrr"])
            methods[m]["latency_ms"].append(row["latency_ms"])

        summary = {}
        for m, vals in methods.items():
            n = len(vals["recall_at_1"])
            summary[m] = {
                "n_questions": n,
                "recall_at_1": round(sum(vals["recall_at_1"]) / n, 4),
                "recall_at_3": round(sum(vals["recall_at_3"]) / n, 4),
                "recall_at_5": round(sum(vals["recall_at_5"]) / n, 4),
                "mrr": round(sum(vals["mrr"]) / n, 4),
                "avg_latency_ms": round(sum(vals["latency_ms"]) / n, 2),
            }

        return {
            "available": True,
            "total_tests": len(raw_results),
            "methods": summary,
            "raw": raw_results,
        }
    except Exception as exc:
        logger.error(f"Error loading evaluation: {exc}")
        return {"available": False, "message": f"Error reading evaluation results: {str(exc)}"}


# ── Static Files ───────────────────────────────────────────────

if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=8000, reload=True)
