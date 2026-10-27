# Run and test CV matching

CV matching runs through the existing Jobora frontend and NestJS API. The internal Python service loads the original trained CV-Embed SBERT model from `training-ai-service/models/cv_matching_sbert`. Matching does not call the RAG service, Gemini, or Groq, and does not save analysis results.

## One-time prerequisites

1. Install Node.js/npm and Python 3.12. SQLite ships with the backend; no database server or MongoDB installation is needed.
2. Install backend and frontend packages if not already installed:

   ```powershell
   cd C:\Users\HP\JOBORA\JOBORA_Backend
   npm install
   cd ..\JOBORA_Frontend
   npm install
   ```

3. Ensure `JOBORA_Backend/.env` exists. If it does not, copy `.env.example` to `.env` and set a strong local `JWT_SECRET`. `SQLITE_PATH` defaults to `data/jobora.sqlite` under the backend. The startup script creates a cryptographically random local matching token if needed, copies it into the backend and AI-service `.env` files, and never prints it.
4. The AI Python virtual environment is created automatically on the first start. This installs the pinned CPU PyTorch/runtime dependencies and can take several minutes.

## Start the matching stack

From the repository root:

```powershell
npm run matching:start
```

The script verifies the JS dependencies, prepares the Python environment if needed, then opens three PowerShell windows: the internal AI service on port 8002, the NestJS API on port 3000, and the React app on port 8443. Keep those windows open while using the app. SQLite is created automatically at `JOBORA_Backend/data/jobora.sqlite`. Matching does not require MongoDB, the RAG service, Ollama, Gemini, or a Groq API key.

Open `http://localhost:8443`, register or sign in, and follow the matching test below. The API sends only CV text assembled server-side from the selected account-owned CV; direct contact fields are excluded.

## Add a CV and run an analysis

1. Sign in, then open **Mon CV** (or `http://localhost:8443/app/cv`).
2. Select **Créer un nouveau CV**. Complete the identity and target-job steps, then add factual details in education, experience, projects, and skills. Use the wizard’s **Continuer** button to save each step. Keep the NestJS window running so each save reaches SQLite.
3. On the final generation step, use **Enregistrer** if you only need matching. CV text and the job description must each contain at least 20 readable characters. Gemini generation is optional and is not required for matching.
4. Open **Matching** (`http://localhost:8443/app/matching`), select the saved CV, paste at least 20 characters of job description, and click **Analyser la compatibilité**.
5. The page should display a 0–100 SBERT cosine-similarity score and up to five suggested job titles. This is text similarity, not an ATS score, a separate skill-gap report, or a hiring probability.

If the CV selector is empty, check the NestJS terminal and confirm that the CV saved while the backend was running. Local browser demo CVs are not available to the protected server matching endpoint.

## Validate without external AI credentials

```powershell
npm run training-ai:matching-test
npm --prefix JOBORA_Backend run build
npm --prefix JOBORA_Backend test
npm --prefix JOBORA_Frontend run build
npm --prefix JOBORA_Frontend test
```

The Python test setup requires the training AI environment. The backend and frontend build/test commands need their respective `node_modules` installed. The original model is included locally; first inference may take a short while to load its weights into memory.

## Stop the stack

Close the three service PowerShell windows. Your application records remain in `JOBORA_Backend/data/jobora.sqlite`.
