import re
from pathlib import Path
from typing import List, Dict, Any
import pymupdf

from rag.config import (
    CHUNK_OVERLAP,
    CHUNK_WORDS,
    MIN_CHUNK_WORDS,
    RAW_DATA_DIR,
)

# Supported extensions
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}


def split_sentences(text: str) -> list[str]:
    """Split text into sentences using basic punctuation rules."""
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    return [
        sentence.strip()
        for sentence in re.split(r"(?<=[.!?])\s+", text)
        if sentence.strip()
    ]


def chunk_text(text: str) -> list[str]:
    """Split text into bounded, overlapping word chunks."""
    sentences = split_sentences(text)
    chunks = []
    current_words = []

    def save_chunk(words):
        if len(words) >= MIN_CHUNK_WORDS:
            chunks.append(" ".join(words))

    for sentence in sentences:
        words = sentence.split()

        # Split unusually long sentences so no chunk exceeds the limit.
        while len(words) > CHUNK_WORDS:
            if current_words:
                save_chunk(current_words)
                current_words = current_words[-CHUNK_OVERLAP:]

            save_chunk(words[:CHUNK_WORDS])
            words = words[CHUNK_WORDS:]

        if not words:
            continue

        if len(current_words) + len(words) > CHUNK_WORDS:
            save_chunk(current_words)
            current_words = current_words[-CHUNK_OVERLAP:]

        # If overlap plus the next sentence is too large, trim the overlap.
        if len(current_words) + len(words) > CHUNK_WORDS:
            current_words = current_words[-(CHUNK_WORDS - len(words)):]

        current_words.extend(words)

    save_chunk(current_words)
    return chunks


def extract_text_from_pdf(pdf_path: Path) -> List[Dict[str, Any]]:
    """Extract page-by-page text from a PDF file."""
    pages = []
    with pymupdf.open(pdf_path) as pdf:
        for page_number, page in enumerate(pdf, start=1):
            text = page.get_text("text").strip()
            pages.append({"page": page_number, "text": text})
    return pages


def extract_text_from_docx(docx_path: Path) -> List[Dict[str, Any]]:
    """Extract text from a DOCX file, separating paragraphs into logical pages."""
    try:
        import docx
    except ImportError:
        raise ImportError("python-docx is required to extract text from DOCX files.")

    doc = docx.Document(str(docx_path))
    paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
    full_text = "\n\n".join(paragraphs)
    
    if not full_text.strip():
        return []

    # Estimate page blocks (~350 words per page)
    words = full_text.split()
    page_size = 350
    pages = []
    for i in range(0, max(len(words), 1), page_size):
        page_num = (i // page_size) + 1
        page_words = words[i : i + page_size]
        pages.append({"page": page_num, "text": " ".join(page_words)})

    return pages if pages else [{"page": 1, "text": full_text}]


def extract_text_from_text_file(file_path: Path) -> List[Dict[str, Any]]:
    """Extract text from plain text or Markdown files."""
    try:
        content = file_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        content = file_path.read_text(encoding="latin-1", errors="replace")

    words = content.split()
    if not words:
        return []

    # Divide into logical page segments of ~350 words for source citation
    page_size = 350
    pages = []
    for i in range(0, max(len(words), 1), page_size):
        page_num = (i // page_size) + 1
        page_words = words[i : i + page_size]
        pages.append({"page": page_num, "text": " ".join(page_words)})

    return pages if pages else [{"page": 1, "text": content}]


def ingest_document(file_path: Path) -> List[Dict[str, Any]]:
    """
    Extract chunks from any supported document (PDF, TXT, MD, DOCX).
    Returns list of chunk dicts ready for indexing.
    """
    ext = file_path.suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported file type: {ext}. Supported formats: PDF, TXT, MD, DOCX.")

    if not file_path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    # Extract pages
    if ext == ".pdf":
        pages = extract_text_from_pdf(file_path)
    elif ext == ".docx":
        pages = extract_text_from_docx(file_path)
    elif ext in {".txt", ".md"}:
        pages = extract_text_from_text_file(file_path)
    else:
        raise ValueError(f"Handler not found for extension: {ext}")

    try:
        relative_source = file_path.relative_to(RAW_DATA_DIR).as_posix()
    except ValueError:
        relative_source = file_path.name

    documents = []
    for page_info in pages:
        page_number = page_info["page"]
        text = page_info["text"]
        if not text:
            continue

        for chunk_index, chunk in enumerate(chunk_text(text)):
            documents.append(
                {
                    "chunk_id": f"{relative_source}::p{page_number}::c{chunk_index}",
                    "text": chunk,
                    "source": relative_source,
                    "page": page_number,
                    "chunk_index": chunk_index,
                    "n_words": len(chunk.split()),
                }
            )

    return documents


def ingest_pdf(pdf_path: Path) -> list[dict]:
    """Preserve existing ingest_pdf interface for compatibility."""
    return ingest_document(pdf_path)


def ingest_all_documents() -> list[dict]:
    """Read every supported document inside the raw data folder."""
    documents = []
    if not RAW_DATA_DIR.exists():
        return documents

    for file_path in sorted(RAW_DATA_DIR.iterdir()):
        if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
            try:
                documents.extend(ingest_document(file_path))
            except Exception as e:
                print(f"Warning: Could not ingest {file_path.name}: {e}")

    return documents


def ingest_all_pdfs() -> list[dict]:
    """Backward compatibility alias."""
    return ingest_all_documents()
