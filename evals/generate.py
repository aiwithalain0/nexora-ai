
from anthropic import Anthropic

from rag.config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from rag.types import Hit


def generate_answer(question: str, hits: list[Hit]) -> str:
    """Generate an answer using retrieved passages as context."""

    if not ANTHROPIC_API_KEY:
        raise ValueError(
            "ANTHROPIC_API_KEY is missing. "
            "Add your Claude API key to the project's .env file."
        )

    if not hits:
        return "I could not find relevant information in the documents."

    context = "\n\n".join(
        (
            f"Source: {hit.source}, Page: {hit.page}\n"
            f"{hit.text}"
        )
        for hit in hits
    )

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=800,
        system=(
            "Answer the user's question using only the provided "
            "document passages. If the passages do not contain "
            "the answer, clearly say that the information was not "
            "found. Do not invent facts. Be clear and concise."
        ),
        messages=[
            {
                "role": "user",
                "content": (
                    f"Document passages:\n{context}\n\n"
                    f"Question: {question}"
                ),
            }
        ],
    )

    return "\n".join(
        block.text
        for block in response.content
        if block.type == "text"
    )
