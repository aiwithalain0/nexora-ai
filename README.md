
https://github.com/user-attachments/assets/f2c8252f-6691-49c2-840c-093d7a219752


# Nexora AI — Knowledge, Connected.

**Nexora AI** is a Retrieval-Augmented Generation (RAG) knowledge assistant that helps users upload company documents, ask questions in natural language, and retrieve answers grounded in relevant document content.

It combines keyword search, semantic vector search, and hybrid retrieval to find useful information from a local document collection. The project includes a FastAPI backend, a web interface, a document ingestion and indexing pipeline, and evaluation scripts for comparing retrieval methods.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [How It Works](#how-it-works)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Environment Configuration](#environment-configuration)
- [Adding Documents](#adding-documents)
- [Running the Application](#running-the-application)
- [Retrieval Methods](#retrieval-methods)
- [Evaluation Framework](#evaluation-framework)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Security and Privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Organizations store important information in documents such as employee handbooks, company policies, team directories, FAQs, and technical documentation. Finding a specific answer in these documents manually can be time-consuming.

Nexora AI addresses this problem using **Retrieval-Augmented Generation (RAG)**.

Instead of relying exclusively on a language model's pre-existing knowledge, the application retrieves relevant passages from the user's document collection and uses them as context for answering questions.

### Project Goals

- Make company knowledge easier to access.
- Reduce the time spent searching through lengthy documents.
- Provide source information to help users verify answers.
- Compare keyword-based, semantic, and hybrid retrieval approaches.
- Support adding and removing documents from a local knowledge base.
- Evaluate retrieval quality using measurable metrics.

## Key Features

### 1. Document Management

Upload and manage documents through the web application.

Supported file formats include:

- PDF (`.pdf`)
- Microsoft Word (`.docx`)
- Plain text (`.txt`)
- Markdown (`.md`)

The upload endpoint accepts files up to 25 MB each.

### 2. Automatic Document Processing

The ingestion pipeline extracts text from supported documents, divides it into smaller chunks, and prepares the chunks for indexing.

This allows the retrieval system to search specific passages rather than processing an entire document for every question.

### 3. Semantic Vector Search

Nexora AI uses the `BAAI/bge-small-en-v1.5` embedding model to represent text as numerical vectors.

These embeddings help retrieve passages with related meanings, even when the wording of a question differs from the original document.

### 4. BM25 Keyword Search

BM25 retrieves passages based on keyword relevance. It can be useful when questions contain exact names, policy terms, identifiers, or phrases.

### 5. Hybrid Retrieval

Hybrid retrieval combines keyword-based and vector-based search to use both lexical and semantic relevance signals.

The project supports three retrieval methods:

- BM25
- Vector search
- Hybrid search

### 6. Source-Aware Answers

The question-answering pipeline returns answer and source information, including document names and page numbers when available.

Users should check the retrieved passages when answers concern important decisions or company policies.

### 7. Web Interface

The FastAPI application serves a browser-based interface with document-management and question-answering functionality.

### 8. Retrieval Evaluation

The evaluation scripts compare retrieval strategies using metrics such as Recall@K, Mean Reciprocal Rank, and latency.

---

## How It Works

The application follows a typical RAG pipeline.

1. **Document upload:** A user uploads a supported file.
2. **Text extraction:** The ingestion module extracts text from the document.
3. **Text chunking:** The extracted text is divided into smaller, overlapping passages.
4. **Embedding generation:** The embedding model converts passages into vectors.
5. **Indexing:** Chunks are stored in the local retrieval indexes.
6. **Question submission:** A user asks a question through the web interface or command line.
7. **Retrieval:** BM25, vector search, or hybrid retrieval finds relevant passages.
8. **Answer generation:** The generation component uses the retrieved context to produce an answer.
9. **Source review:** The response includes source details where available so users can inspect the supporting content.

### RAG Architecture

```text
                 COMPANY DOCUMENTS
                         |
                         v
                 Document Ingestion
                         |
                         v
                  Text Extraction
                         |
                         v
                    Text Chunking
                         |
                         v
                 Embedding Generation
                         |
                         v
                  Local Index Storage
                         |
                         v
USER QUESTION ---> Retrieval Pipeline
                         |
             +-----------+-----------+
             |           |           |
             v           v           v
           BM25        Vector      Hybrid
             |           |           |
             +-----------+-----------+
                         |
                         v
                Relevant Document Chunks
                         |
                         v
                  Answer Generation
                         |
                         v
                 Answer + Sources
```

RAG can help ground answers in documents, but it does not guarantee correctness. Retrieval errors, incomplete source documents, and language-model mistakes can still occur.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Core application logic |
| FastAPI | Backend API and web application |
| Uvicorn | Local ASGI server |
| HTML | Web interface structure |
| CSS | Interface styling |
| JavaScript | Frontend interactions |
| PyMuPDF | PDF text extraction |
| Sentence Transformers | Text embeddings |
| BAAI/bge-small-en-v1.5 | Embedding model |
| ChromaDB | Persistent vector storage |
| rank-bm25 | Keyword-based retrieval |
| python-dotenv | Local environment configuration |
| NumPy | Numerical operations |
| pytest | Python testing framework |

The language-model provider and model are configured separately from the embedding model.

---

## Project Structure

```text
nexora-ai/
│
├── app.py
│   └── FastAPI web application and API endpoints
│
├── main.py
│   └── Interactive command-line interface
│
├── requirements.txt
│   └── Python dependencies
│
├── .env.example
│   └── Example environment configuration
│
├── .gitignore
│   └── Excludes secrets and local generated files
│
├── data/
│   ├── documents_meta.json
│   │   └── Metadata for managed documents
│   ├── raw/
│   │   └── Uploaded source documents (local only)
│   └── processed/
│       └── Local processed document data
│
├── rag/
│   ├── __init__.py
│   ├── config.py
│   │   └── Configuration and project paths
│   ├── ingest.py
│   │   └── Document extraction and chunking
│   ├── embedder.py
│   │   └── Embedding functionality
│   ├── index.py
│   │   └── Index creation and document management
│   ├── retrieve.py
│   │   └── BM25 and vector retrieval
│   ├── hybrid.py
│   │   └── Hybrid retrieval
│   ├── generate.py
│   │   └── Language-model answer generation
│   ├── pipeline.py
│   │   └── End-to-end RAG pipeline
│   └── types.py
│       └── Shared data types
│
├── evals/
│   ├── questions.json
│   │   └── Evaluation questions and relevant chunk IDs
│   ├── metrics.py
│   │   └── Retrieval evaluation metrics
│   ├── run_eval.py
│   │   └── Retrieval evaluation runner
│   └── generate.py
│       └── Evaluation-related generation utility
│
├── static/
│   ├── index.html
│   │   └── Web interface
│   ├── style.css
│   │   └── Frontend styling
│   ├── app.js
│   │   └── Frontend behaviour
│   └── nexora-logo.jpg
│       └── Project logo
│
├── tests/
│   └── Automated tests, where available
│
├── index/
│   └── Local vector index (generated)
│
├── model_cache/
│   └── Cached local model files
│
└── results/
    └── Generated evaluation results
```

Some directories are created during local execution and are intentionally excluded from version control. The exact files generated depend on how the application is run.

---

## Prerequisites

Before setting up Nexora AI, make sure you have:

- Python 3.10 or a compatible newer version.
- Git.
- Internet access to install dependencies and download the embedding model on first use.
- A valid API key for the language-model provider configured in the application.
- Sufficient disk space and memory for the Python packages, embedding model, and local indexes.

---

## Installation and Setup

### Step 1: Clone the Repository

```bash
git clone https://github.com/aiwithalain0/nexora-ai.git
cd nexora-ai
```

If you already have the project locally, open its project folder in your terminal instead.

### Step 2: Create a Virtual Environment

On Windows PowerShell:

```powershell
py -m venv .venv
```

### Step 3: Activate the Virtual Environment

```powershell
.\.venv\Scripts\Activate.ps1
```

If PowerShell prevents activation, you can use Command Prompt:

```bat
.venv\Scripts\activate.bat
```

### Step 4: Install Dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Wait until installation finishes before starting the application.

---

## Environment Configuration

Nexora AI keeps API credentials outside the source code using a local `.env` file.

The current configuration in `rag/config.py` reads:

- `GROQ_API_KEY`
- `GROQ_MODEL`

Create a `.env` file in the root directory, beside `app.py`.

Example:

```dotenv
GROQ_API_KEY=your_api_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

Replace the placeholder with your own API key. Select a model identifier supported by your provider account and the generation code.

**Important:** The model shown is an example configuration, not a guarantee of current model availability. Check the provider's current model documentation if generation fails.

Also ensure `.env.example` uses the same variable names as the application configuration. Never put real API keys in `.env.example`.

### Protect Your Credentials

- Never commit `.env`.
- Never paste API keys into public issues or documentation.
- Keep `.env` in `.gitignore`.
- If a key becomes exposed, revoke it and create a replacement.

---

## Adding Documents

Nexora AI supports PDF, DOCX, TXT, and Markdown documents.

### Method 1: Upload Through the Web Interface

1. Start the application.
2. Open the web interface in your browser.
3. Navigate to the document or Knowledge Base section.
4. Select a supported document.
5. Upload it and wait for processing to complete.
6. Check the document's indexing status.
7. Ask a question about the uploaded content.

The application is designed to ingest and index uploaded documents. If indexing fails, check the server logs for the specific error.

### Method 2: Add Documents Locally

Create the raw document folder if it does not exist:

```powershell
New-Item -ItemType Directory -Force data\raw
```

Copy your documents into `data/raw/`.

Simply copying a document into the folder may not create its index automatically. Use the application's document-ingestion or upload workflow to index it before asking questions.

### Document Processing

During ingestion, the system:

1. Extracts text from the document.
2. Preserves page information where supported.
3. Splits text into chunks.
4. Adds overlap between chunks to preserve context.
5. Prepares chunks for retrieval and indexing.

The configured chunking settings are:

- Target chunk size: 200 words.
- Chunk overlap: 40 words.
- Minimum retained chunk size: 20 words.

These values are defined in `rag/config.py`.

Scanned PDFs may require OCR if they do not contain extractable text; OCR should not be assumed to be built in.

---

## Running the Application

### Start the Web Application

From the project root, with the virtual environment activated, run:

```bash
uvicorn app:app --reload
```

Open the following addresses in your browser:

| Resource | URL |
|---|---|
| Nexora AI web interface | http://127.0.0.1:8000 |
| Interactive API documentation | http://127.0.0.1:8000/docs |
| Application health endpoint | http://127.0.0.1:8000/api/health |

To stop the server, press `Ctrl+C` in the terminal.

**Note:** `--reload` is intended for development. Do not treat the development server as a production deployment configuration.

### Run the Command-Line Interface

You can also interact with the RAG pipeline from the terminal:

```bash
python main.py
```

The default retrieval method is hybrid.

To choose a retrieval method explicitly:

```bash
python main.py --method hybrid
```

```bash
python main.py --method vector
```

```bash
python main.py --method bm25
```

Type a question at the prompt. The CLI prints the answer and source document/page information. Type `exit` or `quit` to leave.

---

## Retrieval Methods

Nexora AI provides three retrieval approaches.

### BM25 Retrieval

BM25 is a keyword-based ranking algorithm. It scores passages based on query-term relevance.

**Useful for:**

- Exact names and terminology.
- Policy keywords.
- Specific phrases present in documents.

### Vector Retrieval

Vector retrieval compares text embeddings to find passages with related meanings.

**Useful for:**

- Questions phrased differently from the source.
- Semantic similarity.
- Natural-language queries.

### Hybrid Retrieval

Hybrid retrieval combines keyword and semantic retrieval signals.

**Useful for:**

- Queries that include both exact terms and broader meaning.
- Comparing lexical and semantic retrieval behaviour.
- Document collections with different writing styles.

No retrieval method is best for every situation. Evaluate the methods using representative questions and relevant source chunks from your own collection.

---

## Evaluation Framework

Nexora AI includes scripts for comparing retrieval methods.

The evaluation dataset is stored in:

`evals/questions.json`

It contains questions and their associated relevant chunk IDs.

Run the evaluation from the project root:

```bash
python -m evals.run_eval
```

The script evaluates BM25, vector, and hybrid retrieval and writes the results to:

`results/evaluation.json`

The `results/` directory is ignored by Git because evaluation outputs are generated locally.

### Evaluation Metrics

| Metric | Description |
|---|---|
| Recall@1 | Measures whether a relevant chunk appears in the first result |
| Recall@3 | Measures whether a relevant chunk appears within the first three results |
| Recall@5 | Measures whether a relevant chunk appears within the first five results |
| MRR | Mean Reciprocal Rank; rewards relevant chunks appearing near the top |
| Latency | Time taken for a retrieval operation, measured in milliseconds |

### Why Evaluation Matters

Evaluation helps you determine whether the retriever is finding the right information before the language model generates an answer.

To improve the evaluation:

1. Create realistic questions based on your documents.
2. Label the chunk IDs that contain relevant information.
3. Run the evaluation.
4. Compare retrieval methods using the same dataset.
5. Review missed results and improve chunking, indexing, or retrieval configuration.

Evaluation scores depend on the quality of the questions and relevance labels. Results should not be treated as proof of answer accuracy or hallucination prevention.

---

## API Endpoints

Nexora AI uses FastAPI to expose application functionality.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Serves the web interface |
| GET | `/api/health` | Reports application and index health |
| POST | `/api/ask` | Answers a question using the selected retrieval method |
| GET | `/api/knowledge` | Lists managed documents and index information |
| POST | `/api/documents/upload` | Uploads and indexes a document |
| DELETE | `/api/documents/{filename}` | Removes a document and its indexed chunks |

### Ask a Question

Send a POST request to `/api/ask` with JSON such as:

```json
{
  "question": "What is the refund policy?",
  "method": "hybrid",
  "k": 5
}
```

Fields:

- `question`: The question to answer.
- `method`: `hybrid`, `vector`, or `bm25`.
- `k`: Number of passages to retrieve, from 1 to 20.

Example using PowerShell:

```powershell
$body = @{
    question = "What is the refund policy?"
    method = "hybrid"
    k = 5
} | ConvertTo-Json

Invoke-RestMethod `
    -Uri "http://127.0.0.1:8000/api/ask" `
    -Method Post `
    -ContentType "application/json" `
    -Body $body
```

The exact answer and source structure depend on the indexed documents and pipeline output.

### Check Application Health

Open:

`http://127.0.0.1:8000/api/health`

The endpoint reports information such as whether the index contains chunks, the configured embedding model, and the default retrieval method. It is designed not to expose API keys.

### API Documentation

FastAPI provides interactive API documentation at:

`http://127.0.0.1:8000/docs`

Use this page to inspect the available routes and test requests against your local server.

---

## Configuration

The main settings are defined in `rag/config.py` and `app.py`.

| Setting | Purpose |
|---|---|
| `GROQ_API_KEY` | Private API credential for the configured generation provider |
| `GROQ_MODEL` | Language-model identifier |
| `EMBEDDING_MODEL` | Model used to create text embeddings |
| `CHUNK_WORDS` | Target chunk size |
| `CHUNK_OVERLAP` | Number of words retained as overlap |
| `MIN_CHUNK_WORDS` | Minimum chunk size |
| `INDEX_DIR` | Local vector index directory |
| `RAW_DATA_DIR` | Source document directory |
| `MAX_UPLOAD_SIZE` | Maximum permitted upload size |

Review the source files before changing these settings. Defaults can change as the project evolves.

---

## Security and Privacy

Security is important because company knowledge bases can contain internal or confidential information.

### API Keys

Keep API keys in the local `.env` file. Never store real credentials in source code or commit them to GitHub.

### Private Documents

Raw documents, processed files, vector indexes, model caches, and generated evaluation results are intended to remain local by default.

Only upload documents you have permission to process.

### Local Deployment

The default development address is `127.0.0.1`, which is appropriate for local testing.

Before deploying the application publicly, review and implement appropriate:

- Authentication and authorization.
- Document access controls.
- Request and upload limits.
- CORS restrictions.
- Logging and error handling.
- Secure secret management.
- Deployment and network configuration.

Do not assume that a development configuration is safe for a public deployment.

### Answer Reliability

RAG can improve grounding by retrieving document context, but it cannot guarantee that every answer is accurate or complete. Verify important answers against the original sources.

---

## Troubleshooting

### 1. API Key Error

- Check that `.env` exists in the project root.
- Confirm the variable name matches `rag/config.py`.
- Replace placeholder values with valid credentials.
- Restart the application after changing environment variables.

### 2. Model Unavailable

Confirm that the configured model is currently supported by your provider account and by the generation code. Update `GROQ_MODEL` as needed.

### 3. No Documents Found

- Confirm that the file uses a supported format.
- Check the document's status in the Knowledge Base.
- Confirm that indexing completed successfully.
- Check the local index and application logs.

### 4. Incorrect or Incomplete Answers

- Verify that the relevant document is indexed.
- Try another retrieval method.
- Ask a more specific question.
- Inspect the retrieved source passages.
- Add representative examples to the evaluation dataset.

### 5. PDF Text Is Missing

Some PDFs contain scanned page images instead of selectable text. Such documents may require an OCR step before they can be searched effectively.

### 6. Dependency Installation Fails

Check your Python version, virtual environment activation, and the complete installation error. Upgrade pip and retry the installation before investigating individual packages.

---

## Future Improvements

Potential areas for future development include:

- Automated testing of ingestion, indexing, retrieval, and API endpoints.
- OCR support for scanned PDFs.
- Improved answer-grounding checks and explicit responses when the documents do not contain an answer.
- Authentication and role-based document access.
- Evaluation dashboards and historical metric comparisons.
- Better handling of large document collections.
- Production deployment configuration and monitoring.
- Consistent provider configuration across `.env.example`, `rag/config.py`, and generation code.

These are potential improvements, not a claim that every item is currently implemented.

---

## Contributing

Contributions and improvements are welcome.

1. Create a branch for your changes.
2. Make a focused improvement.
3. Run relevant tests and evaluations.
4. Check `git status` to ensure no secrets or private documents are staged.
5. Commit your changes with a descriptive message.
6. Push your branch and open a pull request if appropriate.

---

## License

No license has been specified in this repository yet. Until a license is added, do not assume that the code is available for unrestricted reuse, modification, or redistribution.

---

## Project Identity

**Nexora AI**

*Knowledge, Connected.*

A document-focused RAG assistant designed to make organizational knowledge easier to find, understand, and verify.
