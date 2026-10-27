# JOBORA CV backend

NestJS 11 backend for JWT authentication, local SQLite persistence, Gemini CV generation, two-level ATS validation, and retrieval through a local Python RAG service.

## Local architecture

```text
React frontend -> NestJS API -> Python FastAPI RAG service -> local ChromaDB PersistentClient
                         |
                         +-> SQLite file (data/jobora.sqlite)
                         +-> Google Gemini API
```

Docker and WSL are not required. ChromaDB runs as a Python library and stores its collection persistently in `rag_service/data/chroma/`.

## Configuration

Copy `.env.example` to `.env` and set a long `JWT_SECRET`. `SQLITE_PATH` defaults to `data/jobora.sqlite`; no external database server is required. Set `GEMINI_API_KEY` only if using the separate CV-generation features. Never expose it through a `VITE_` variable or commit `.env`.

Important variables are `SQLITE_PATH`, `JWT_SECRET`, `GEMINI_MODEL`, `GEMINI_TIMEOUT_MS`, `RAG_SERVICE_URL`, `RAG_SERVICE_TIMEOUT_MS`, `RAG_COLLECTION`, `RAG_TOP_K`, `RAG_EMBEDDING_MODEL`, `RAG_DOCUMENTS_DIR`, `PROMPTS_DIR`, and `FRONTEND_URL`.

## First installation on Windows

Prerequisites: Node.js/npm and Python 3.12 with pip. SQLite is embedded in the backend; no MongoDB server is needed.

```powershell
cd "C:\Users\HP\JOBORA\JOBORA_Backend"
npm install
npm run build
```

The SQLite database is created automatically at `data/jobora.sqlite`. To use RAG-backed CV generation or ATS validation, additionally run `npm run rag:setup` and `npm run rag:index`; matching itself does not depend on RAG.

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
| POST | `/api/matching/upload` | Extract and save a PDF CV (5 MB max) for the authenticated user in SQLite. |
| POST | `/api/matching/analyze` | Compare an owned saved CV with a job description using SBERT; returns semantic similarity and top role suggestions. |

`userId` always comes from the verified JWT, never request JSON.

### Matching API contract

`POST /api/matching/analyze` requires `Authorization: Bearer <JWT>` and accepts
JSON `{ "cvId": "...", "jobDescription": "..." }`. The selected CV is looked
up using both its ID and the authenticated user ID. `jobDescription` must be
20–30,000 characters; `cvId` is required and limited to 180 characters. The
backend sends selected non-contact CV facts and the job text to the existing
internal Python AI service. The response is
`{ "compatibility_score": 0..100, "top_job_matches": [{ "title": "...", "score": 0..100 }], "algorithm": "SBERT cosine similarity" }`.

No matching record is persisted. A missing/foreign CV returns 404; invalid
inputs return 400/422; an unavailable model or internal service returns 503.
`POST /api/matching/upload` accepts multipart field `file`, PDF only, max 5 MB;
NestJS extracts the profile and persists it in SQLite. The score is semantic
text similarity—not a probability of hiring, ATS
score, skills checklist, or evidence-based qualification assessment. The
analyzer did not implement those latter comparisons, so the UI does not invent
them. The analyzer's original Gemini-generated job listings were excluded
because they were not verified real opportunities and Gemini is unnecessary
for the core matching algorithm.

## Verification

```powershell
npm run build
npm test
```

Automated Gemini tests use mocks and never consume the API key. A live Gemini verification also depends on Google service availability and quota. Detailed architecture, prompts, results, limitations, and test boundaries are in the repository-level `README.md`.
