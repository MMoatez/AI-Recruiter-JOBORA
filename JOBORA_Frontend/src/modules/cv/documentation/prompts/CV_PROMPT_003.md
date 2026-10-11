# CV_PROMPT_003

- Version: 3.0
- Purpose: Generate validated, structured ATS-friendly CV content for rendering by the application.
- Technique used: Role, context, task, format, constraints, zero-shot transformation, few-shot grounding example, priming, iteration.
- Model: Google Gemini (backend integration target; model selected by server configuration).
- Input: Target job plus candidate JSON inside `<candidate_data>` delimiters.

## Complete prompt

The deployed prompt is composed from [`cv-system.prompt`](./cv-system.prompt) and [`cv-generation.prompt`](./cv-generation.prompt). Keeping the complete text in dedicated files prevents controller duplication and allows prompt versioning.

## Expected output

Valid JSON matching the documented schema exactly, containing only candidate-provided facts. The backend must parse and schema-validate it before persistence.

## Actual output

The current Figma Make repository has no backend runtime, so automated calls use a deterministic local adapter and never call Gemini from the browser. The UI and data contract are ready for server integration.

## Problems detected

- A production Gemini call cannot safely originate from this static Vite client.
- Model output can still be malformed or unavailable.

## Changes made

- Isolated the prompt from candidate data.
- Added injection-resistance instructions and a grounded few-shot example.
- Added an exact JSON-only schema.
- Added deterministic ATS checks in application code.
- Defined graceful handling for missing data and invalid model output.

## Final result

Selected prompt version: `CV_PROMPT_003`. A future backend must load `GEMINI_API_KEY` from its environment, call Gemini, validate the returned JSON, run deterministic checks, and persist only after both validations succeed.
