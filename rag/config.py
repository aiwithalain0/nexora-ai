
from pathlib import Path
import os

from dotenv import load_dotenv


# Find the main project folder
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Load private settings from the project's .env file
load_dotenv(PROJECT_ROOT / ".env")

# Document folders
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"
PROCESSED_DATA_DIR = PROJECT_ROOT / "data" / "processed"

# Vector database folder
INDEX_DIR = PROJECT_ROOT / "index"

# Embedding model used to understand text meaning
EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5"

# Text chunking settings
CHUNK_WORDS = 200
CHUNK_OVERLAP = 40
MIN_CHUNK_WORDS = 20

# Claude API settings
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
