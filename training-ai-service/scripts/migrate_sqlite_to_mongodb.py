from __future__ import annotations

import argparse
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

from pymongo import ASCENDING, MongoClient, UpdateOne


def rows(connection: sqlite3.Connection, table: str) -> list[dict]:
    return [dict(row) for row in connection.execute(f"SELECT * FROM {table}").fetchall()]


def main() -> int:
    parser = argparse.ArgumentParser(description="Repeat-safe JOBORA Training SQLite-to-Mongo migration.")
    parser.add_argument("--sqlite", type=Path, required=True)
    parser.add_argument("--mongo-uri", required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--user-map", type=Path, help="JSON object mapping SQLite user_reference values to JOBORA JWT user IDs")
    parser.add_argument("--default-user-id", help="Single JOBORA user ID for a local single-user database")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not args.sqlite.is_file(): parser.error("SQLite database does not exist")
    mapping = json.loads(args.user_map.read_text(encoding="utf-8")) if args.user_map else {}
    def owner(reference: str) -> str:
        value = mapping.get(reference) or args.default_user_id
        if not value: raise ValueError(f"No JOBORA user mapping for {reference!r}")
        return value

    connection = sqlite3.connect(f"file:{args.sqlite.resolve()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    plans = rows(connection, "learning_plans"); progress = rows(connection, "task_progress")
    questions = rows(connection, "assessment_questions"); sessions = rows(connection, "assessment_sessions")
    answers = defaultdict(list)
    for answer in rows(connection, "assessment_answers"): answers[answer["session_id"]].append(answer)
    mastery = rows(connection, "mastery_history")
    summary = {"training_plans": len(plans), "training_task_progress": len(progress),
               "training_assessment_questions": len(questions), "training_assessment_sessions": len(sessions),
               "training_mastery_history": len(mastery), "dry_run": args.dry_run}
    # Resolve ownership before connecting or writing so an incomplete map cannot partially migrate.
    plan_owners = {row["id"]: owner(row["user_reference"]) for row in plans}
    session_owners = {row["id"]: owner(row["user_reference"]) for row in sessions}
    mastery_owners = [owner(row["user_reference"]) for row in mastery]
    if args.dry_run:
        print(json.dumps(summary, indent=2)); return 0

    client = MongoClient(args.mongo_uri, serverSelectionTimeoutMS=5000)
    client.admin.command("ping"); database = client[args.database]
    operations = {
        "training_plans": [UpdateOne({"id": r["id"]}, {"$set": {"id": r["id"], "userId": plan_owners[r["id"]],
            "title": r["title"], "careerGoal": r["career_goal"], "weeklyHours": r["weekly_hours"], "targetWeeks": r["target_weeks"],
            "preferredLanguage": r["preferred_language"], "freeOnly": bool(r["free_only"]), "status": r["status"],
            "provenance": r["provenance"], "modelName": r["model_name"], "content": json.loads(r["plan_json"]),
            "createdAt": r["created_at"], "updatedAt": r["updated_at"]}}, upsert=True) for r in plans],
        "training_task_progress": [UpdateOne({"userId": plan_owners[r["plan_id"]], "planId": r["plan_id"], "taskId": r["task_id"]},
            {"$set": {"userId": plan_owners[r["plan_id"]], "planId": r["plan_id"], "taskId": r["task_id"], "status": r["status"],
             "completionPercent": r["completion_percent"], "minutesSpent": r["minutes_spent"], "evidenceNote": r["evidence_note"],
             "updatedAt": r["updated_at"]}}, upsert=True) for r in progress],
        "training_assessment_questions": [UpdateOne({"id": r["id"]}, {"$set": {"id": r["id"], "conceptId": r["concept_id"],
            "skill": r["skill"], "prompt": r["prompt"], "choices": json.loads(r["choices_json"]), "correctChoice": r["correct_choice"],
            "explanation": r["explanation"], "difficulty": r["difficulty"], "reviewStatus": r["review_status"], "source": r["source"],
            "reviewedBy": r.get("reviewed_by"), "reviewedAt": r.get("reviewed_at"), "reviewDecision": r.get("review_decision"),
            "questionBankVersion": r.get("question_bank_version", 1)}}, upsert=True) for r in questions],
        "training_assessment_sessions": [UpdateOne({"id": r["id"]}, {"$set": {"id": r["id"], "userId": session_owners[r["id"]],
            "planId": r["plan_id"], "skill": r["skill"], "status": r["status"],
            "questionIds": [x["question_id"] for x in connection.execute("SELECT question_id FROM assessment_session_questions WHERE session_id=? ORDER BY position", (r["id"],))],
            "answers": [{"questionId": a["question_id"], "selectedChoice": a["selected_choice"], "isCorrect": bool(a["is_correct"]), "answeredAt": a["answered_at"]} for a in answers[r["id"]]],
            "createdAt": r["created_at"], "submittedAt": r["submitted_at"]}}, upsert=True) for r in sessions],
        "training_mastery_history": [UpdateOne({"sessionId": r["session_id"], "questionId": r["question_id"]}, {"$set": {
            "userId": mastery_owners[index], "conceptId": r["concept_id"], "skill": next((q["skill"] for q in questions if q["id"] == r["question_id"]), "unknown"),
            "sessionId": r["session_id"], "questionId": r["question_id"], "prior": r["prior"],
            "observationPosterior": r["observation_posterior"], "nextPrior": r["next_prior"], "correct": bool(r["correct"]),
            "parameterVersion": r["parameter_version"], "createdAt": r["created_at"]}}, upsert=True) for index, r in enumerate(mastery)],
    }
    for collection, writes in operations.items():
        if writes: database[collection].bulk_write(writes, ordered=False)
    database.training_plans.create_index([("id", ASCENDING)], unique=True)
    database.training_task_progress.create_index([("userId", ASCENDING), ("planId", ASCENDING), ("taskId", ASCENDING)], unique=True)
    database.training_assessment_questions.create_index([("id", ASCENDING)], unique=True)
    database.training_assessment_sessions.create_index([("id", ASCENDING)], unique=True)
    database.training_mastery_history.create_index([("sessionId", ASCENDING), ("questionId", ASCENDING)], unique=True)
    print(json.dumps(summary, indent=2)); return 0


if __name__ == "__main__": raise SystemExit(main())
