from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from .db import Database
from .schemas import (
    GeneratedRoadmap,
    LearningResource,
    LearningPlanResponse,
    PlanCreateRequest,
    SkillGap,
    TaskProgressResponse,
    TaskProgressUpdate,
    TrainingAnalyzeRequest,
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class TrainingRepository:
    def __init__(self, database: Database) -> None:
        self.database = database

    def create_draft(self, request: PlanCreateRequest) -> LearningPlanResponse:
        plan_id = f"plan_{uuid4().hex}"
        now = _now()
        with self.database.connect() as connection:
            connection.execute(
                """INSERT INTO learning_plans
                (id, user_reference, title, career_goal, weekly_hours, target_weeks,
                 preferred_language, free_only, status, provenance, plan_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', 'manual', '{}', ?, ?)""",
                (
                    plan_id,
                    request.user_reference,
                    request.title,
                    request.career_goal,
                    request.weekly_hours,
                    request.target_weeks,
                    request.preferred_language,
                    int(request.free_only),
                    now,
                    now,
                ),
            )
        result = self.get(plan_id)
        assert result is not None
        return result

    def save_analysis(
        self,
        request: TrainingAnalyzeRequest,
        gaps: list[SkillGap],
        roadmap: GeneratedRoadmap,
        resources: list[LearningResource],
        model_name: str,
    ) -> LearningPlanResponse:
        plan_id = f"plan_{uuid4().hex}"
        now = _now()
        content = {
            "gaps": [gap.model_dump(mode="json") for gap in gaps],
            "roadmap": roadmap.model_dump(mode="json"),
            "resources": [resource.model_dump(mode="json") for resource in resources],
        }
        with self.database.connect() as connection:
            connection.execute(
                """INSERT INTO learning_plans
                (id, user_reference, title, career_goal, weekly_hours, target_weeks,
                 preferred_language, free_only, status, provenance, model_name, plan_json, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ready', 'live_ai', ?, ?, ?, ?)""",
                (
                    plan_id, request.user_reference, roadmap.title, request.career_goal,
                    request.weekly_hours, request.target_weeks, request.preferred_language,
                    int(request.free_only), model_name, json.dumps(content, ensure_ascii=False), now, now,
                ),
            )
        result = self.get(plan_id)
        assert result is not None
        return result

    def get(self, plan_id: str) -> LearningPlanResponse | None:
        with self.database.connect() as connection:
            row = connection.execute("SELECT * FROM learning_plans WHERE id = ?", (plan_id,)).fetchone()
            if row is None:
                return None
            progress_rows = connection.execute(
                "SELECT * FROM task_progress WHERE plan_id = ? ORDER BY task_id", (plan_id,)
            ).fetchall()
        progress = []
        for item in progress_rows:
            public_item = dict(item)
            public_item.pop("plan_id", None)
            progress.append(TaskProgressResponse(**public_item))

        return LearningPlanResponse(
            id=row["id"],
            user_reference=row["user_reference"],
            title=row["title"],
            career_goal=row["career_goal"],
            weekly_hours=row["weekly_hours"],
            target_weeks=row["target_weeks"],
            preferred_language=row["preferred_language"],
            free_only=bool(row["free_only"]),
            status=row["status"],
            provenance=row["provenance"],
            model_name=row["model_name"],
            content=json.loads(row["plan_json"]),
            progress=progress,
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def update_progress(self, plan_id: str, task_id: str, update: TaskProgressUpdate) -> TaskProgressResponse | None:
        now = _now()
        with self.database.connect() as connection:
            exists = connection.execute("SELECT 1 FROM learning_plans WHERE id = ?", (plan_id,)).fetchone()
            if exists is None:
                return None
            connection.execute(
                """INSERT INTO task_progress
                (plan_id, task_id, status, completion_percent, minutes_spent, evidence_note, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(plan_id, task_id) DO UPDATE SET
                  status = excluded.status,
                  completion_percent = excluded.completion_percent,
                  minutes_spent = excluded.minutes_spent,
                  evidence_note = excluded.evidence_note,
                  updated_at = excluded.updated_at""",
                (
                    plan_id,
                    task_id,
                    update.status,
                    update.completion_percent,
                    update.minutes_spent,
                    update.evidence_note,
                    now,
                ),
            )
            connection.execute("UPDATE learning_plans SET updated_at = ? WHERE id = ?", (now, plan_id))
        return TaskProgressResponse(task_id=task_id, updated_at=now, **update.model_dump())
