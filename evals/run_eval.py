
import json
import time
from pathlib import Path

from evals.metrics import recall_at_k, reciprocal_rank
from rag.retrieve import BM25Retriever, VectorRetriever
from rag.hybrid import HybridRetriever


PROJECT_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_FILE = PROJECT_ROOT / "evals" / "questions.json"
RESULTS_DIR = PROJECT_ROOT / "results"


def main():
    with QUESTIONS_FILE.open("r", encoding="utf-8") as file:
        questions = json.load(file)

    retrievers = [
        BM25Retriever(),
        VectorRetriever(),
        HybridRetriever(),
    ]

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    results = []

    for retriever in retrievers:
        for item in questions:
            start = time.perf_counter()
            hits = retriever.search(item["question"], k=5)
            latency_ms = (time.perf_counter() - start) * 1000

            retrieved_ids = [hit.chunk_id for hit in hits]
            relevant_ids = item.get("relevant_chunk_ids", [])

            results.append({
                "question_id": item["id"],
                "method": retriever.name,
                "recall_at_1": recall_at_k(
                    retrieved_ids, relevant_ids, 1
                ),
                "recall_at_3": recall_at_k(
                    retrieved_ids, relevant_ids, 3
                ),
                "recall_at_5": recall_at_k(
                    retrieved_ids, relevant_ids, 5
                ),
                "mrr": reciprocal_rank(
                    retrieved_ids, relevant_ids
                ),
                "latency_ms": round(latency_ms, 2),
                "retrieved_chunk_ids": retrieved_ids,
            })

    output_file = RESULTS_DIR / "evaluation.json"
    with output_file.open("w", encoding="utf-8") as file:
        json.dump(results, file, indent=2)

    print(f"Evaluation completed: {len(results)} search tests")
    print(f"Results saved to: {output_file}")


if __name__ == "__main__":
    main()
