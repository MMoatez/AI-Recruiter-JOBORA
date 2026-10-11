# Gemini backend integration contract

The repository includes a NestJS 11 backend in `backend/`, MongoDB persistence through Mongoose, JWT authentication and a server-only Gemini service. The browser must never receive `GEMINI_API_KEY`.

## Required environment variable

```text
GEMINI_API_KEY=<server-only secret>
```

Do not prefix this variable with `VITE_`; Vite-prefixed variables are exposed to client bundles.

## Implemented authenticated endpoints

- `GET /api/cvs` — list the authenticated user's CVs.
- `POST /api/cvs` — create a CV owned by the authenticated user.
- `PATCH /api/cvs/:id` — update only an owned CV.
- `DELETE /api/cvs/:id` — delete only an owned CV.
- `POST /api/cvs/:id/generate` — call Gemini with `CV_PROMPT_003`, validate JSON, then save.
- `POST /api/cvs/:id/regenerate-section` — regenerate only the requested section.
- `POST /api/cvs/:id/validate-ats` — combine deterministic checks with optional Gemini language review.

Authentication endpoints:

- `POST /api/auth/register`
- `POST /api/auth/login`

Every endpoint derives `userId` from the authenticated session, never from the request body. Validate input DTOs, cap field lengths, treat candidate content as untrusted data, normalize model errors, and never log prompts containing private candidate data or secret values.
