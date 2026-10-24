# JOBORA Training AI service

This is JOBORA's internal, compute-only Training service. NestJS owns JWT
authentication, user authorization, question review, and MongoDB persistence.
The browser must never call this Python service directly.

## Runtime boundary

The merged entrypoint is `app.jobora_main:app`. It exposes only:

- `GET /internal/health`
- token-protected `/internal/training/*` computation routes

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
- `TRAINING_AI_INTERNAL_TOKEN`: shared only with the NestJS backend.
- `AI_RECRUITER_USE_FINETUNED_EMBEDDINGS`: keep `false`.

SQLite-related variables in `.env.example` apply only to the preserved legacy
application and migration tools, not `app.jobora_main`.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The tests cover BKT, reviewed-question integrity, resource selection, skill
matching, experiment evaluation, migration logic, and the internal-only JOBORA
route boundary.

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
