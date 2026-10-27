# JOBORA Training AI service

This is JOBORA's internal, compute-only Training service. NestJS owns JWT
authentication, user authorization, question review, and MongoDB persistence.
The browser must never call this Python service directly.

## Runtime boundary

The merged entrypoint is `app.jobora_main:app`. It exposes only:

- `GET /internal/health`
- token-protected `/internal/training/*` and `/internal/matching/*` computation routes

It does not initialize SQLite or expose the legacy browser API. The preserved
`app.main:app`, SQLite repositories, and `data/training.db` exist only for
regression history and optional migration; they are not runtime dependencies
of the merged JOBORA application.

Keep the service bound to `127.0.0.1` when NestJS runs on the same computer.
For separate hosts, use a private network, restrict ingress to NestJS, and keep
the shared token enabled.

## Portable Windows setup

Install Python 3.12, then run from this directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_windows.ps1
Copy-Item .env.example .env
# Set GROQ_API_KEY and the same TRAINING_AI_INTERNAL_TOKEN used by NestJS.
.\.venv\Scripts\python.exe -m uvicorn app.jobora_main:app --host 127.0.0.1 --port 8002
```

The setup script creates a project-local virtual environment and installs the
trusted official CPU build `torch==2.5.1+cpu`, which is constrained in
`constraints-windows.txt`. Never copy a virtual environment between computers.

The default pretrained embedding model is
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`. Its first use
downloads model files from Hugging Face into the current user's standard cache.
The experimental fine-tuned checkpoint remains preserved but disabled because
held-out evaluation did not justify deployment.

## Environment variables

- `GROQ_API_KEY`: server-only GroqCloud key; never use a `VITE_*` variable.
- `GROQ_MODEL`: structured-output model, default `openai/gpt-oss-20b`.
- `GROQ_TIMEOUT_SECONDS`: request timeout from 0 to 180 seconds.
- `SENTENCE_TRANSFORMER_MODEL`: pretrained embedding model identifier.
- `CV_MATCHING_MODEL_PATH`: optional override path to CV-Embed's bundled trained SBERT directory. If omitted, the service uses `models/cv_matching_sbert`, then falls back to `SENTENCE_TRANSFORMER_MODEL` if the model files are absent.
- `TRAINING_AI_INTERNAL_TOKEN`: shared only with the NestJS backend.
- `AI_RECRUITER_USE_FINETUNED_EMBEDDINGS`: keep `false`.

The original CV-Embed SBERT artifact is bundled in `models/cv_matching_sbert`
so deployment uses the analyzer's actual trained weights without requiring a
second checkout or model download. `CV_MATCHING_MODEL_PATH` can override the
bundled directory. The configured multilingual sentence-transformer is only a
fallback if the model files are absent. No Gemini credential or external
generative API is required for matching.

### CV / job matching route

NestJS calls `POST /internal/matching/analyze` using the shared internal token.
The request includes only sanitized CV text assembled from the authenticated
user's saved CV and the submitted job description. The service returns a
0–100 cosine-similarity score, the five closest role labels from the original
analyzer's fixed taxonomy, and the algorithm name. It does not persist CV text
or analysis results.

The merged training runtime remains compute-only and does not open a database;
Jobora's NestJS backend owns application persistence in its local SQLite file.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The tests cover BKT, reviewed-question integrity, resource selection, skill
matching, SBERT similarity and role ranking, matching route authorization,
experiment evaluation, migration logic, and the internal-only JOBORA route
boundary.

## Optional legacy migration

The migration reads SQLite in read-only mode and upserts into MongoDB. Always
perform a dry run and map legacy user references to real JOBORA user IDs before
writing:

```powershell
.\.venv\Scripts\python.exe scripts/migrate_sqlite_to_mongodb.py `
  --sqlite data/training.db `
  --mongo-uri $env:MONGODB_URI `
  --database <team-database-name> `
  --user-map user-map.json `
  --dry-run
```
