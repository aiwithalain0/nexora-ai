
from groq import Groq
from rag.config import GROQ_API_KEY, GROQ_MODEL


def generate_answer(question, hits):
    if not GROQ_API_KEY:
        raise ValueError(
            "GROQ_API_KEY is missing. Add it to your .env file."
        )

    if not hits:
        return "I couldn't find relevant information in the company documents."

    context = "\n\n".join(
        f"Source: {hit.source}, Page: {hit.page}\n{hit.text}"
        for hit in hits
    )

    client = Groq(api_key=GROQ_API_KEY)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a company knowledge assistant. "
                    "Answer using only the provided document context. "
                    "If the answer is not in the context, say you don't "
                    "know based on the available documents. "
                    "Do not invent facts."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Document context:\n{context}\n\n"
                    f"Question: {question}"
                ),
            },
        ],
        temperature=0.1,
    )

    return response.choices[0].message.content or ""
