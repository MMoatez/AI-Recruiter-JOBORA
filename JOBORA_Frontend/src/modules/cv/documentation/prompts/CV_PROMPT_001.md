# CV_PROMPT_001

- Version: 1.0
- Purpose: Produce a first professional rewrite of raw candidate data.
- Technique used: Zero-shot; role + task.
- Model: Google Gemini (backend integration target; model selected by server configuration).
- Input: Candidate JSON and target job.

## Complete prompt

> You are an HR specialist. Rewrite the candidate information as a professional CV for the target job. Return the professional summary, experiences, education, projects and skills.

## Expected output

Professional, concise CV content grounded in the input.

## Actual output

The prototype review showed fluent prose, but inconsistent section names and occasional unsupported achievements.

## Problems detected

- No machine-readable format.
- Hallucination risk was not explicitly constrained.
- Candidate text was not isolated as untrusted data.

## Changes made

Added explicit anti-hallucination rules, missing-data behavior, and prompt-injection protection in version 2.

## Final result

Rejected for production use; retained as the zero-shot baseline.
