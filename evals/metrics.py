
def recall_at_k(
    retrieved_ids: list[str],
    relevant_ids: list[str],
    k: int,
) -> float:
    """Calculate the fraction of relevant passages found in top-k results."""
    if not relevant_ids or k <= 0:
        return 0.0

    retrieved_top_k = set(retrieved_ids[:k])
    relevant = set(relevant_ids)

    return len(retrieved_top_k & relevant) / len(relevant)


def reciprocal_rank(
    retrieved_ids: list[str],
    relevant_ids: list[str],
) -> float:
    """Score the position of the first relevant result."""
    relevant = set(relevant_ids)

    if not relevant:
        return 0.0

    for rank, chunk_id in enumerate(retrieved_ids, start=1):
        if chunk_id in relevant:
            return 1.0 / rank

    return 0.0


def average(values: list[float]) -> float:
    """Calculate the average of a list of numbers."""
    if not values:
        return 0.0

    return sum(values) / len(values)
