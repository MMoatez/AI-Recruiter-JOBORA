# AI Recruiter — NestJS backend

NestJS 11 backend for authentication, MongoDB persistence, Gemini CV generation and ATS validation.

## Requirements

- Node.js 20 or newer
- MongoDB 7/8 locally, MongoDB Atlas, or Docker Desktop
- A Google Gemini API key for real generation

## Configuration

Copy the example environment file:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure:

```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/ai_recruiter
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1h
GEMINI_API_KEY=your_real_google_ai_studio_key
GEMINI_MODEL=gemini-3.8-flash
FRONTEND_URL=http://localhost:8443
```

Never commit `.env`. Never rename the key to `VITE_GEMINI_API_KEY`.

## Start MongoDB

With a local MongoDB service, ensure it is running on port `27017`.

With Docker:

```powershell
docker compose up -d mongodb
```

## Start the backend

```powershell
cd backend
npm.cmd install
npm.cmd run start:dev
```

The API runs at `http://localhost:3000/api`.

## Start the frontend

In a second PowerShell window:

```powershell
cd "C:\Users\yassi\Desktop\AI Recruiter Platform Design"
npm.cmd run dev
```

Open `http://localhost:8443`. Create an account or use the demo account so the frontend receives a real JWT from the backend. If the backend is unavailable, the local demo fallback remains available.

## API endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create an account and return JWT tokens. |
| `POST` | `/api/auth/login` | Authenticate and return JWT tokens. |
| `GET` | `/api/cvs` | List the authenticated user's CVs. |
| `GET` | `/api/cvs/:id` | Read one owned CV. |
| `POST` | `/api/cvs` | Create a CV. |
| `PATCH` | `/api/cvs/:id` | Update an owned CV. |
| `DELETE` | `/api/cvs/:id` | Delete an owned CV. |
| `POST` | `/api/cvs/:id/generate` | Generate structured CV content with Gemini. |
| `POST` | `/api/cvs/:id/regenerate-section` | Regenerate only one requested section. |
| `POST` | `/api/cvs/:id/validate-ats` | Run deterministic ATS checks. |

All CV endpoints require `Authorization: Bearer <accessToken>`. The server derives `userId` from this token and never trusts a user ID from the request body.

## Verification

```powershell
npm.cmd run build
npm.cmd test
```

The automated tests mock Gemini and do not call the real API.
