from __future__ import annotations

import argparse
import json

from .assessment_repository import AssessmentRepository
from .config import get_settings
from .db import Database


def main() -> int:
    parser = argparse.ArgumentParser(description="Local maintenance tool for reviewing Groq assessment questions.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    subparsers.add_parser("list", help="List pending questions including their private answer keys.")
    decide = subparsers.add_parser("decide", help="Approve or reject one pending question.")
    decide.add_argument("--question-id", required=True)
    decide.add_argument("--decision", required=True, choices=("approved", "rejected"))
    decide.add_argument("--reviewer", required=True, help="Auditable local reviewer reference.")
    args = parser.parse_args()

    settings = get_settings()
    database = Database(settings.database_path)
    database.initialize()
    repository = AssessmentRepository(database)
    if args.command == "list":
        print(json.dumps(repository.pending_questions(), ensure_ascii=False, indent=2, default=str))
        return 0
    if not repository.review_question(args.question_id, args.decision, args.reviewer):
        parser.error("question not found or is not a Groq-generated question")
    print(f"{args.question_id}: {args.decision} by {args.reviewer}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
