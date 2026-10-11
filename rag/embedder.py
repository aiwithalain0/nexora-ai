
from sentence_transformers import SentenceTransformer

from rag.config import EMBEDDING_MODEL, PROJECT_ROOT


QUERY_PREFIX = (
    "Represent this sentence for searching relevant passages: "
)


class Embedder:
    def __init__(self):
        # Keep the downloaded model on D: instead of filling C:.
        model_cache = PROJECT_ROOT / "model_cache"
        model_cache.mkdir(parents=True, exist_ok=True)

        self.model = SentenceTransformer(
            EMBEDDING_MODEL,
            cache_folder=str(model_cache),
        )

        # Load the model before we start measuring search latency.
        self.embed_query("Warm-up query")

    def embed_documents(self, texts: list[str]):
        """Convert document chunks into vectors."""
        return self.model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )

    def embed_query(self, query: str):
        """Convert a search query into a vector."""
        return self.model.encode(
            [QUERY_PREFIX + query],
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )[0]
