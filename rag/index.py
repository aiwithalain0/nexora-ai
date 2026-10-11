import json
from pathlib import Path
from typing import List, Dict, Any, Optional

import chromadb

from rag.config import (
    CHUNK_OVERLAP,
    CHUNK_WORDS,
    EMBEDDING_MODEL,
    INDEX_DIR,
    PROCESSED_DATA_DIR,
    RAW_DATA_DIR,
)
from rag.embedder import Embedder
from rag.ingest import ingest_all_documents, ingest_document


def get_chunks_file_path() -> Path:
    """Return path to JSONL chunks file for current word/overlap config."""
    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    return PROCESSED_DATA_DIR / f"chunks_w{CHUNK_WORDS}_o{CHUNK_OVERLAP}.jsonl"


def get_collection_name() -> str:
    """Create a collection name for the current model and chunk settings."""
    model_slug = EMBEDDING_MODEL.split("/")[-1].replace(".", "_").replace("-", "_")
    return f"rag_{model_slug}_w{CHUNK_WORDS}_o{CHUNK_OVERLAP}"


def load_all_chunks_from_file() -> List[Dict[str, Any]]:
    """Load chunks from the processed JSONL file."""
    chunks_file = get_chunks_file_path()
    if not chunks_file.exists():
        return []
    with chunks_file.open("r", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def save_all_chunks_to_file(chunks: List[Dict[str, Any]]) -> None:
    """Persist all chunks to the processed JSONL file."""
    chunks_file = get_chunks_file_path()
    with chunks_file.open("w", encoding="utf-8") as f:
        for chunk in chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + "\n")


def build_index() -> int:
    """Read all documents, create embeddings, and store them in ChromaDB."""
    documents = ingest_all_documents()

    if not documents:
        raise ValueError(
            "No document chunks found. Add supported files (PDF, TXT, MD, DOCX) to data/raw/ first."
        )

    # Save processed chunks
    save_all_chunks_to_file(documents)

    # Create embeddings locally
    embedder = Embedder()
    texts = [document["text"] for document in documents]
    vectors = embedder.embed_documents(texts)

    # Create or open ChromaDB collection
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(INDEX_DIR))
    collection = client.get_or_create_collection(
        name=get_collection_name(),
        metadata={"hnsw:space": "cosine"},
    )

    batch_size = 64
    for start in range(0, len(documents), batch_size):
        batch = documents[start : start + batch_size]
        batch_vectors = vectors[start : start + batch_size]

        collection.upsert(
            ids=[item["chunk_id"] for item in batch],
            documents=[item["text"] for item in batch],
            embeddings=batch_vectors.tolist(),
            metadatas=[
                {
                    "source": item["source"],
                    "page": item["page"],
                    "chunk_index": item["chunk_index"],
                    "n_words": item["n_words"],
                }
                for item in batch
            ],
        )

    print(f"Chunks processed: {len(documents)}")
    print(f"Vector collection: {get_collection_name()}")
    return len(documents)


def add_document_to_index(file_path: Path) -> int:
    """
    Ingest a single document, embed its chunks, and add/update them in ChromaDB and JSONL.
    Prevents duplicates by first removing any prior chunks for this document.
    Returns the number of chunks added.
    """
    new_chunks = ingest_document(file_path)
    if not new_chunks:
        raise ValueError(f"No extractable text found in '{file_path.name}'.")

    try:
        source_name = file_path.relative_to(RAW_DATA_DIR).as_posix()
    except ValueError:
        source_name = file_path.name

    # Remove any prior chunks for this source from JSONL
    existing_chunks = load_all_chunks_from_file()
    filtered_chunks = [c for c in existing_chunks if c.get("source") != source_name]
    filtered_chunks.extend(new_chunks)
    save_all_chunks_to_file(filtered_chunks)

    # Embed new chunks
    embedder = Embedder()
    texts = [c["text"] for c in new_chunks]
    vectors = embedder.embed_documents(texts)

    # Open collection
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    client = chromadb.PersistentClient(path=str(INDEX_DIR))
    collection = client.get_or_create_collection(
        name=get_collection_name(),
        metadata={"hnsw:space": "cosine"},
    )

    # Delete any existing ChromaDB entries with this source
    try:
        collection.delete(where={"source": source_name})
    except Exception:
        pass

    # Upsert new vectors
    batch_size = 64
    for start in range(0, len(new_chunks), batch_size):
        batch = new_chunks[start : start + batch_size]
        batch_vectors = vectors[start : start + batch_size]

        collection.upsert(
            ids=[item["chunk_id"] for item in batch],
            documents=[item["text"] for item in batch],
            embeddings=batch_vectors.tolist(),
            metadatas=[
                {
                    "source": item["source"],
                    "page": item["page"],
                    "chunk_index": item["chunk_index"],
                    "n_words": item["n_words"],
                }
                for item in batch
            ],
        )

    return len(new_chunks)


def remove_document_from_index(source_name: str) -> int:
    """
    Remove all chunks associated with source_name from ChromaDB and JSONL.
    Returns number of chunks removed.
    """
    # Remove from ChromaDB
    removed_count = 0
    try:
        INDEX_DIR.mkdir(parents=True, exist_ok=True)
        client = chromadb.PersistentClient(path=str(INDEX_DIR))
        collection = client.get_or_create_collection(
            name=get_collection_name(),
            metadata={"hnsw:space": "cosine"},
        )
        existing = collection.get(where={"source": source_name})
        if existing and existing.get("ids"):
            removed_count = len(existing["ids"])
            collection.delete(ids=existing["ids"])
    except Exception as exc:
        print(f"Warning deleting from ChromaDB: {exc}")

    # Remove from JSONL
    existing_chunks = load_all_chunks_from_file()
    filtered_chunks = [c for c in existing_chunks if c.get("source") != source_name]
    save_all_chunks_to_file(filtered_chunks)

    return removed_count
