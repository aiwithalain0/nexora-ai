
from rag.retrieve import BM25Retriever, VectorRetriever
from rag.hybrid import HybridRetriever
from rag.generate import generate_answer


def ask(
    question: str,
    method: str = "hybrid",
    k: int = 5,
) -> dict:
    """Retrieve relevant passages and generate an answer."""

    if not question.strip():
        raise ValueError("Please enter a question.")

    retrievers = {
        "bm25": BM25Retriever,
        "vector": VectorRetriever,
        "hybrid": HybridRetriever,
    }

    if method not in retrievers:
        raise ValueError(
            "Method must be 'bm25', 'vector', or 'hybrid'."
        )

    retriever = retrievers[method]()
    hits = retriever.search(question, k=k)
    answer = generate_answer(question, hits)

    return {
        "question": question,
        "method": method,
        "answer": answer,
        "sources": [
            {
                "source": hit.source,
                "page": hit.page,
                "score": round(hit.score, 4),
                "chunk_id": hit.chunk_id,
                "text": hit.text,
            }
            for hit in hits
        ],
    }
