
from rag.retrieve import BM25Retriever, VectorRetriever
from rag.types import Hit


class HybridRetriever:
    """Combine keyword and vector search using Reciprocal Rank Fusion."""

    name = "hybrid"

    def __init__(self):
        self.bm25 = BM25Retriever()
        self.vector = VectorRetriever()

    def search(self, query: str, k: int = 5) -> list[Hit]:
        """Combine both ranked lists and return the top-k passages."""
        if k <= 0:
            return []

        # Retrieve a wider list before combining rankings.
        bm25_hits = self.bm25.search(query, k=max(k * 2, 10))
        vector_hits = self.vector.search(query, k=max(k * 2, 10))

        # Accumulate reciprocal rank scores for each chunk.
        rrf_scores = {}
        hit_by_id = {}
        rrf_constant = 60

        for hits in (bm25_hits, vector_hits):
            for rank, hit in enumerate(hits, start=1):
                rrf_scores[hit.chunk_id] = (
                    rrf_scores.get(hit.chunk_id, 0.0)
                    + 1.0 / (rrf_constant + rank)
                )
                hit_by_id[hit.chunk_id] = hit

        ranked_ids = sorted(
            rrf_scores,
            key=lambda chunk_id: rrf_scores[chunk_id],
            reverse=True,
        )[:k]

        return [
            Hit(
                chunk_id=chunk_id,
                text=hit_by_id[chunk_id].text,
                source=hit_by_id[chunk_id].source,
                page=hit_by_id[chunk_id].page,
                score=rrf_scores[chunk_id],
            )
            for chunk_id in ranked_ids
        ]
