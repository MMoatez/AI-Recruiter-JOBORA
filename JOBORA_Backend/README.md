# JOBORA CV backend

NestJS 11 backend for JWT authentication, MongoDB CV persistence, Gemini content generation, two-level ATS validation, and retrieval through a local Python RAG service.

## Local architecture

```text
React frontend -> NestJS API -> Python FastAPI RAG service -> local ChromaDB PersistentClient
                         |
                         +-> MongoDB
                         +-> Google Gemini API
```

Docker and WSL are not required. ChromaDB runs as a Python library and stores its collection persistently in `rag_service/data/chroma/`.

## Configuration

Copy `.env.example` to `.env` and set a long `JWT_SECRET` plus `GEMINI_API_KEY`. Never expose the key through a `VITE_` variable or commit `.env`.

Important variables are `MONGODB_URI`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `RAG_SERVICE_URL`, `RAG_SERVICE_TIMEOUT_MS`, `RAG_COLLECTION`, `RAG_TOP_K`, `RAG_EMBEDDING_MODEL`, `RAG_DOCUMENTS_DIR`, `PROMPTS_DIR`, and `FRONTEND_URL`.

## First installation on Windows

Prerequisites: Node.js/npm, Python 3.12 with pip, and MongoDB running locally.

```powershell
cd "C:\Users\yassi\Desktop\projet AI\JOBORA_Backend"
npm install
npm run rag:setup
npm run build
npm run rag:index
```

`rag:setup` creates the isolated Python environment `rag_service/.venv` and installs the service dependencies from `rag_service/requirements.txt`. The first index may download the local ONNX MiniLM model. The index is persistent and is rebuilt only when the knowledge documents or embedding configuration change.

If PowerShell blocks `npm.ps1`, use `npm.cmd` for that command or configure `RemoteSigned` for the current user.

## Start the backend stack

Open two terminals in `JOBORA_Backend`.

Terminal 1 — local RAG service:

```powershell
npm run rag:start
```

Terminal 2 — NestJS:

```powershell
npm run start:dev
```

The RAG health endpoint is `http://127.0.0.1:8001/health`. The NestJS API is `http://localhost:3000/api`.

Start the frontend separately from `JOBORA_Frontend` with `npm run dev`.

## RAG commands

```powershell
npm run rag:index
npm run rag:reindex
```

- `rag:index` keeps the current persistent index when its fingerprint is unchanged.
- `rag:reindex` deliberately rebuilds the collection after corpus or embedding changes.
- Source documents remain in `knowledge_base/`; indexed vectors live under ignored local storage in `rag_service/data/`.

## Authenticated CV API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET/POST | `/api/cvs` | List or create owned CVs. |
| GET/PATCH/DELETE | `/api/cvs/:id` | Read, update, or delete an owned CV. |
| POST | `/api/cvs/:id/generate` | RAG context -> Gemini JSON -> ATS validation -> persistence. |
| POST | `/api/cvs/:id/regenerate-section` | Regenerate summary, one experience, or one project. |
| POST | `/api/cvs/:id/validate-ats` | Run deterministic and Gemini/RAG validation. |
| GET | `/api/cvs/rag/status` | Check the Python service and indexed chunk count. |

`userId` always comes from the verified JWT, never request JSON.

## Verification

```powershell
npm run build
npm test
rag_service\.venv\Scripts\python.exe -m unittest discover -s rag_service -p "test_*.py"
Invoke-RestMethod http://127.0.0.1:8001/health
```

Automated Gemini tests use mocks and never consume the API key. A live Gemini verification also depends on Google service availability and quota. Detailed architecture, prompts, results, limitations, and test boundaries are in the repository-level `README.md`.
