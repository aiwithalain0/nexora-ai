
import argparse

from rag.pipeline import ask


def main():
    parser = argparse.ArgumentParser(
        description="Ask questions about your PDF documents."
    )

    parser.add_argument(
        "--method",
        choices=["bm25", "vector", "hybrid"],
        default="hybrid",
        help="Search method to use.",
    )

    args = parser.parse_args()

    print("RAG Knowledge Assistant")
    print("Type 'exit' to quit.\n")

    while True:
        question = input("Your question: ").strip()

        if question.lower() in {"exit", "quit"}:
            print("Goodbye!")
            break

        if not question:
            continue

        try:
            result = ask(question, method=args.method)

            print("\nAnswer:")
            print(result["answer"])

            print("\nSources:")
            for source in result["sources"]:
                print(
                    f"- {source['source']}, "
                    f"page {source['page']}"
                )

            print()

        except Exception as error:
            print(f"\nError: {error}\n")


if __name__ == "__main__":
    main()
