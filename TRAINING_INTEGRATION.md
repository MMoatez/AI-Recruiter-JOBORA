# JOBORA Training & Certifications integration handoff

## Staging boundary

This document is relative to the merged JOBORA project root. The source projects were treated as read-only. Legacy SQLite application code and the read-only migration utility are preserved, but local database files are intentionally excluded. Fine-tuning source, reviewed datasets, metrics, predictions, and reports are included; generated model checkpoints are intentionally excluded because the baseline remains deployed. Do not merge `.venv`, `node_modules`, build output, caches, or local `.env` files.

## Architecture and ports

```text
JOBORA React :8443
  -> JOBORA NestJS :3000 (JWT ownership, MongoDB persistence)
       -> existing Skillora AI :8000
       -> existing RAG service :8001
       -> Training FastAPI :8002 (loopback, shared internal token)
```

The browser never calls Training FastAPI. Groq roadmap generation, multilingual Sentence Transformers, BKT equations, adaptive rules, resources, and fine-tuning experiments stay in Python. The original pretrained embedding model remains active by default. The JOBORA runtime entrypoint is `app.jobora_main:app`; it is compute-only, initializes no SQLite database, and exposes no legacy browser routes.

## Directory structure

- `JOBORA_Frontend/src/modules/training/`: authenticated Training page, API adapter, contracts.
- `JOBORA_Backend/src/training/`: Nest controller, service, DTOs, Mongoose schemas, tests.
- `JOBORA_Backend/scripts/review-training-question.mjs`: local Mongo question-review command; not exposed over HTTP.
- `training-ai-service/`: Training Python backend, tests, resources, migration tooling, and reproducible fine-tuning experiment evidence.
- `training-ai-service/app/internal_training.py`: token-protected inference-only routes.
- `training-ai-service/app/jobora_main.py`: internal-only JOBORA FastAPI entrypoint.
- `training-ai-service/scripts/setup_windows.ps1`: portable Python 3.12 and CPU-PyTorch setup.
- `training-ai-service/scripts/migrate_sqlite_to_mongodb.py`: repeat-safe migration with dry run.

## MongoDB collections and indexes

- `training_plans`: unique `id`; `{userId, updatedAt}`.
- `training_task_progress`: unique `{userId, planId, taskId}`.
- `training_assessment_questions`: unique `id`; `{skill, reviewStatus}`; private answer keys never leave Nest except after submission.
- `training_assessment_sessions`: unique `id`; `{userId, createdAt}`; answers embedded with the owned session.
- `training_mastery_history`: unique `{sessionId, questionId}`; `{userId, conceptId, createdAt}`.

Every browser route uses JOBORA's `JwtAuthGuard`. `userId` comes only from the verified token and every plan/session/history query includes it. Request bodies cannot select ownership.

## Assessment consistency

Submission atomically claims one owned session with `active -> processing`; a duplicate request cannot claim it. All referenced questions are loaded and must be `approved` before scoring. Each mastery observation has a unique `{sessionId, questionId}` index. If MongoDB is a standalone server without multi-document transactions, failures trigger compensating deletion of that session's mastery writes and reset the session to `active`. A replica set may later replace this with `withTransaction`; the current strategy is explicitly designed for the team's likely standalone local MongoDB.

Question approval is local maintenance only:

```powershell
cd JOBORA_Backend
# Uses the same MONGODB_URI configured for JOBORA.
npm run training:review -- q_groq_... approved faculty-reviewer
```

## Environment variables

NestJS (`JOBORA_Backend/.env`):

```text
MONGODB_URI=mongodb://127.0.0.1:27017/jobora
JWT_SECRET=replace-me
FRONTEND_URL=http://localhost:8443
PORT=3000
TRAINING_AI_SERVICE_URL=http://127.0.0.1:8002
TRAINING_AI_TIMEOUT_MS=120000
TRAINING_AI_INTERNAL_TOKEN=the-same-long-random-secret
```

For an isolated Atlas verification database, `MONGODB_URI` is the required Mongoose configuration variable. Use the Atlas-provided SRV hostname and keep the database segment exactly `jobora_training_integration_test`:

```text
MONGODB_URI=mongodb+srv://<database-user>:<url-encoded-password>@<atlas-cluster-host>/jobora_training_integration_test?retryWrites=true&w=majority
```

This is a test format example only; no credentials are included. The merged application must use the team's existing `MONGODB_URI` and database, with Training data isolated by its `training_*` collection names. `jobora_training_integration_test` is reserved for disposable verification and is not a production requirement. Put real values only in `JOBORA_Backend/.env` or the backend process environment. Do not place them in `.env.example`, a `VITE_*` variable, logs, screenshots, or source control.

Training FastAPI (`training-ai-service/.env`):

```text
GROQ_API_KEY=server-only-key
GROQ_MODEL=openai/gpt-oss-20b
TRAINING_AI_INTERNAL_TOKEN=the-same-long-random-secret
AI_RECRUITER_USE_FINETUNED_EMBEDDINGS=false
```

Never use a `VITE_*` variable for either secret.

## Installation and startup

### MongoDB prerequisite

Verification on 2026-10-24 found no `mongod` command, no MongoDB Windows service, and no listener on port 27017. A Docker CLI was present, but there was no Docker Desktop executable or running engine, so no container image was pulled and no system software was installed.

For local testing, install MongoDB Community Server from MongoDB's official distribution, bind it to loopback, and use a disposable database. For the merged application, reuse JOBORA's existing `MONGODB_URI`; do not create a second Training database connection. After a local installation, verify with:

```powershell
Get-Service | Where-Object Name -Match 'Mongo'
Get-NetTCPConnection -LocalPort 27017 -State Listen
```

Then set the staged backend only:

```powershell
$env:MONGODB_URI="mongodb://127.0.0.1:27017/jobora_training_integration_test"
```

```powershell
cd JOBORA_Backend
npm ci
npm run start:dev
```

```powershell
cd training-ai-service
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_windows.ps1
Copy-Item .env.example .env
# Configure GROQ_API_KEY and the shared internal token.
.\.venv\Scripts\python.exe -m uvicorn app.jobora_main:app --host 127.0.0.1 --port 8002
```

```powershell
cd JOBORA_Frontend
npm ci
npm run dev
```

## SQLite-to-MongoDB migration

If a legacy SQLite database must be imported, provide its path outside source control and map every legacy `user_reference` to a real JOBORA Mongo user ID. Dry-run resolves all owners before opening MongoDB:

```powershell
cd training-ai-service
.\.venv\Scripts\python.exe scripts/migrate_sqlite_to_mongodb.py `
  --sqlite <path-to-legacy-training.db> `
  --mongo-uri mongodb://127.0.0.1:27017 `
  --database jobora_training_test `
  --user-map user-map.json `
  --dry-run
```

Remove `--dry-run` only after reviewing counts. For a known single-user local database, `--default-user-id <mongo-user-id>` may replace the map. Upserts and unique indexes make reruns repeat-safe. The supplied source database is opened with SQLite `mode=ro`; no database file is included in the repository.

## Verification performed

- NestJS build: passed from the current remote-based feature branch.
- NestJS/Jest: 10 suites, 77 tests passed, including Training ownership and unapproved-question rollback.
- Training Python regression suite: 44 passed with one upstream Starlette TestClient deprecation warning, including the internal-only JOBORA entrypoint contract and bounded Groq JSON-repair behavior.
- Internal FastAPI token check: missing token `403`; valid BKT call `200`, next prior `0.648`.
- Curated internal bank: Docker returned 3 questions; keys stayed on the internal route.
- Frontend Vite production build: passed, 1938 modules.
- Frontend tests: 15 passed, including JWT forwarding to NestJS and confirmation that Training analysis does not submit a client-selected owner.
- SQLite migration dry run: passed against copied SQLite data.
- Frontend strict `tsc --noEmit`: blocked by four pre-existing `Card title/subtitle` errors in `src/modules/interview/InterviewPage.tsx` lines 164-168 and newly merged Portfolio test files whose Testing Library/Vitest dependencies and callback types are absent from the current remote package manifest. Training introduced no reported TypeScript error; Interview and Portfolio were not modified.
- Live MongoDB connectivity/persistence and end-to-end JWT HTTP testing: not run because no MongoDB server was listening on port 27017. The migration was not executed against a database.
- The initial unconstrained Torch `2.14.1` package failed to initialize `c10.dll` with `WinError 1114`. Running the portable Windows setup replaced it with the trusted official `torch==2.5.1+cpu`; the setup validation succeeded and all 41 tests then passed directly in the project-local staged environment.
- Training FastAPI was launched on loopback port 8002 against the staged source. Health returned `200`, a missing internal token returned `403`, and an authorized BKT request returned `200` with the expected calculated response. The temporary verification token was process-local and was not written to a file.
- The new `app.jobora_main` runtime was launched directly: `/internal/health` returned `200` with `nestjs-mongodb` persistence, the legacy `/api/v1/training/mastery` route returned `404`, a missing internal token returned `403`, and an authorized BKT calculation returned `200` with next prior `0.78`.
- The bounded Groq structured-output/JSON-repair regression tests pass. A prior live call from the original Training project returned a validated roadmap, but no live Groq call was repeated from this clean clone; current quota and model access are therefore not claimed.
- NestJS could not be launched successfully against persistent storage because its required MongoDB connection was unavailable. Consequently disposable-user registration/login, authenticated browser routes, cross-user HTTP denial, Mongo persistence, transaction capability, and the complete browser workflow remain unverified in a live stack.
- `npm ci` reported four inherited backend dependency advisories (one moderate, three high); no forced dependency upgrade was applied.

### Atlas verification status (2026-10-24)

- `AppModule` loads `MONGODB_URI` through global `ConfigModule` and passes it directly to `MongooseModule.forRootAsync`, with a five-second server-selection timeout.
- No staged `JOBORA_Backend/.env` exists and the current process has no `MONGODB_URI`. Only `.env.example` contains a non-secret example.
- Per the integration safety requirements, no Atlas hostname, username, password, or URI was invented. Connectivity, indexes, CRUD, migration writes, JWT owner isolation, assessment/mastery persistence, duplicate HTTP submissions, rollback behavior, deployment mode, and transaction support could not be tested.
- Once a URI is supplied, confirm deployment mode with the MongoDB `hello` command and run a real transaction probe against disposable documents. Do not infer transaction support solely from the `mongodb+srv` scheme.

### Python Torch investigation (2026-10-24)

- Both Python installations are CPython 3.12 x64.
- The staged environment resolved Torch `2.14.1`; importing it fails while loading `torch\\lib\\c10.dll` with Windows `WinError 1114`.
- The existing read-only compatible environment uses the official CPU build Torch `2.5.1+cpu` and imports successfully. The staged and original DLL sizes differ, confirming they are different builds rather than a missing copy of the same artifact.
- The original environment was not altered. No DLL was copied and no replacement package was installed.
- Recommended remediation is to recreate the staged environment and pin a trusted official CPU-only PyTorch build compatible with Python 3.12 before installing the remaining project dependencies. Preserve `AI_RECRUITER_USE_FINETUNED_EMBEDDINGS=false`; model artifacts and baseline selection remain unchanged.

### Portability verification (2026-10-24)

- Training integration source, scripts, and handoff documentation contain no personal `C:\Users\...` paths or dependency on either original project directory.
- `scripts/setup_windows.ps1` passed PowerShell syntax parsing and uses only paths relative to `training-ai-service`.
- A dependency-resolution dry run succeeded against the official PyTorch CPU index and selected `torch-2.5.1+cpu`; it made no environment changes.
- The Windows setup script was executed successfully against the project-local environment, repaired the Torch DLL failure, and validated the required imports. A brand-new second-computer installation remains naturally untested here.
- The pretrained Hugging Face model is identified explicitly and downloads into each teammate's normal user cache on first use; no personal cache path is configured.
- Root startup now launches `app.jobora_main:app` on port 8002, avoiding existing services on ports 8000 and 8001.
- The pre-existing root and backend JOBORA READMEs still contain a teammate's old absolute example paths. They are outside the Training module, were not modified, and are not used by Training startup or runtime code.

## Files added

- `JOBORA_Backend/src/training/dto/training.dto.ts`
- `JOBORA_Backend/src/training/training.schemas.ts`
- `JOBORA_Backend/src/training/training.service.ts`
- `JOBORA_Backend/src/training/training.controller.ts`
- `JOBORA_Backend/src/training/training.module.ts`
- `JOBORA_Backend/src/training/training.service.spec.ts`
- `JOBORA_Backend/scripts/review-training-question.mjs`
- `JOBORA_Frontend/src/modules/training/types.ts`
- `JOBORA_Frontend/src/modules/training/trainingService.ts`
- `JOBORA_Frontend/src/modules/training/trainingService.test.ts`
- `training-ai-service/app/internal_training.py`
- `training-ai-service/app/jobora_main.py`
- `training-ai-service/constraints-windows.txt`
- `training-ai-service/scripts/setup_windows.ps1`
- `training-ai-service/scripts/migrate_sqlite_to_mongodb.py`
- `TRAINING_INTEGRATION.md`

## Files modified

- `JOBORA_Backend/src/app.module.ts`
- `JOBORA_Backend/package.json`
- `JOBORA_Backend/.env.example`
- `JOBORA_Frontend/src/modules/training/TrainingPage.tsx` (placeholder replaced)
- `JOBORA_Frontend/src/index.css` (Training-only styles appended)
- `JOBORA_Frontend/package.json` and lockfile (portable TypeScript test runner)
- `training-ai-service/app/config.py`
- `training-ai-service/app/main.py`
- `training-ai-service/.env.example`
- `training-ai-service/README.md`
- `training-ai-service/pyproject.toml`
- root `package.json`

`package-lock.json` files and local `node_modules/` were generated by `npm ci`; these are installation artifacts, not intentional source edits.

## Likely merge conflicts

- `JOBORA_Backend/src/app.module.ts`
- root and backend `package.json`
- `JOBORA_Backend/.env.example`
- `JOBORA_Frontend/src/modules/training/TrainingPage.tsx`
- the end of `JOBORA_Frontend/src/index.css`

No CV, Matching, Interview, Letter, Portfolio, existing Skillora, or RAG logic was modified.

## Team merge checklist

1. Merge `JOBORA_Backend/src/training/`, register `TrainingModule` in `app.module.ts`, and merge the Training environment placeholders and review command.
2. Merge `JOBORA_Frontend/src/modules/training/`, the Training page/styles, and the `tsx` test dependency/script changes.
3. Copy `training-ai-service/`, including resources, datasets, tests, migration utility, and experiment reports; exclude `.venv`, `.env`, caches, build output, local databases, and generated model checkpoints.
4. Merge the root Training AI setup/dev/test scripts from `package.json`.
5. Configure JOBORA's existing `MONGODB_URI` and `JWT_SECRET`; configure the Python Groq key and matching internal token separately.
6. Run `npm run training-ai:setup:windows`, then start FastAPI on 8002, NestJS on 3000, and the frontend on 8443.
7. Before merge approval, run the database-backed authenticated acceptance workflow in an isolated database and then restore the normal team database URI.

## Remaining merge blockers

1. Configure `MONGODB_URI` for an Atlas database named `jobora_training_integration_test`; no Atlas credential is currently present.
2. Run the migration without `--dry-run` using disposable test-user mappings, then execute authenticated cross-user HTTP and persistence tests.
3. Determine the MongoDB deployment mode with `db.hello()` and test transaction support. Until then, the documented atomic claim, unique indexes, and compensation path are the active consistency design, not a live-verified transaction strategy.
4. Verify `scripts/setup_windows.ps1` once more in a clean checkout on a teammate's Windows laptop. It succeeds locally; never copy a virtual environment between machines.
5. Verify live Groq roadmap generation and the browser flows for analysis, resources, quiz submission, persistence after refresh, mastery, and recommendations once MongoDB is available.
6. Supply matching internal tokens without exposing them to the browser or source control.
7. Resolve the pre-existing Interview TypeScript errors if the team requires standalone `tsc --noEmit` in CI.
8. Review the inherited npm security advisories with the team before dependency upgrades.

## Merge readiness decision

The Training implementation is structurally integrated and its automated tests and production builds pass, but it is **not yet ready for final team merge as a fully verified integration**. Real MongoDB persistence, authenticated end-to-end ownership, live rollback/consistency behavior, transaction capability, and the browser workflow have not been exercised because no MongoDB runtime or Atlas credential is available. The feature branch is suitable for a review PR; the database-backed acceptance run above remains mandatory before merge approval.
