
import json
import re

import chromadb
from rank_bm25 import BM25Okapi

from rag.config import (
    CHUNK_OVERLAP,
    CHUNK_WORDS,
    INDEX_DIR,
    PROCESSED_DATA_DIR,
)
from rag.embedder import Embedder
from rag.index import get_collection_name
from rag.types import Hit


def tokenize(text: str) -> list[str]:
    """Convert text into lowercase words."""
    return re.findall(r"\b\w+\b", text.lower())


class BM25Retriever:
    """Search document chunks using matching words."""

    name = "bm25"

    def __init__(self):
        chunks_file = (
            PROCESSED_DATA_DIR
            / f"chunks_w{CHUNK_WORDS}_o{CHUNK_OVERLAP}.jsonl"
        )

        if not chunks_file.exists():
            raise FileNotFoundError(
                f"Processed chunks not found: {chunks_file}. "
                "Build the index first."
            )

        with chunks_file.open("r", encoding="utf-8") as file:
            self.documents = [
                json.loads(line)
                for line in file
                if line.strip()
            ]

        if not self.documents:
            raise ValueError("The processed chunks file is empty.")

        tokenized_documents = [
            tokenize(document["text"])
            for document in self.documents
        ]

        self.bm25 = BM25Okapi(tokenized_documents)

    def search(self, query: str, k: int = 5) -> list[Hit]:
        """Return the top matching passages."""
        if k <= 0:
            return []

        query_tokens = tokenize(query)

        if not query_tokens:
            return []

        scores = self.bm25.get_scores(query_tokens)

        ranked_indices = sorted(
            range(len(scores)),
            key=lambda i: scores[i],
            reverse=True,
        )[:k]

        return [
            Hit(
                chunk_id=self.documents[i]["chunk_id"],
                text=self.documents[i]["text"],
                source=self.documents[i]["source"],
                page=self.documents[i]["page"],
                score=float(scores[i]),
            )
            for i in ranked_indices
        ]


class VectorRetriever:
    """Search document chunks using meaning-based similarity."""

    name = "vector"

    def __init__(self):
        client = chromadb.PersistentClient(path=str(INDEX_DIR))

        self.collection = client.get_or_create_collection(
            name=get_collection_name(),
            metadata={"hnsw:space": "cosine"},
        )

        self.embedder = Embedder()

        if self.collection.count() == 0:
            raise ValueError(
                "The vector index is empty. "
                "Add PDFs and build the index first."
            )

    def search(self, query: str, k: int = 5) -> list[Hit]:
        """Return the most semantically similar passages."""
        if k <= 0:
            return []

        count = self.collection.count()

        if count == 0:
            return []

        query_vector = self.embedder.embed_query(query)

        results = self.collection.query(
            query_embeddings=[query_vector.tolist()],
            n_results=min(k, count),
            include=["documents", "metadatas", "distances"],
        )

        hits = []

        for i, chunk_id in enumerate(results["ids"][0]):
            metadata = results["metadatas"][0][i]
            distance = results["distances"][0][i]

            hits.append(
                Hit(
                    chunk_id=chunk_id,
                    text=results["documents"][0][i],
                    source=metadata["source"],
                    page=metadata["page"],
                    score=float(1.0 - distance),
                )
            )

        return hits
