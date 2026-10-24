from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator


SCHEMA = """
CREATE TABLE IF NOT EXISTS learning_plans (
    id TEXT PRIMARY KEY,
    user_reference TEXT NOT NULL,
    title TEXT NOT NULL,
    career_goal TEXT NOT NULL,
    weekly_hours INTEGER NOT NULL CHECK (weekly_hours BETWEEN 1 AND 80),
    target_weeks INTEGER NOT NULL CHECK (target_weeks BETWEEN 1 AND 104),
    preferred_language TEXT NOT NULL,
    free_only INTEGER NOT NULL CHECK (free_only IN (0, 1)),
    status TEXT NOT NULL CHECK (status IN ('draft', 'generating', 'ready', 'failed')),
    provenance TEXT NOT NULL CHECK (provenance IN ('manual', 'live_ai')),
    model_name TEXT,
    plan_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_progress (
    plan_id TEXT NOT NULL REFERENCES learning_plans(id) ON DELETE CASCADE,
    task_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('not_started', 'in_progress', 'completed')),
    completion_percent INTEGER NOT NULL CHECK (completion_percent BETWEEN 0 AND 100),
    minutes_spent INTEGER NOT NULL DEFAULT 0 CHECK (minutes_spent BETWEEN 0 AND 100000),
    evidence_note TEXT CHECK (length(evidence_note) <= 1000),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (plan_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_plans_user_reference
ON learning_plans(user_reference, updated_at DESC);

CREATE TABLE IF NOT EXISTS assessment_sessions (
    id TEXT PRIMARY KEY,
    plan_id TEXT REFERENCES learning_plans(id) ON DELETE SET NULL,
    user_reference TEXT NOT NULL,
    skill TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'submitted')),
    created_at TEXT NOT NULL,
    submitted_at TEXT
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id TEXT PRIMARY KEY,
    concept_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    prompt TEXT NOT NULL,
    choices_json TEXT NOT NULL,
    correct_choice INTEGER NOT NULL,
    explanation TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    review_status TEXT NOT NULL CHECK (review_status IN ('approved', 'pending_review', 'rejected')),
    source TEXT NOT NULL CHECK (source IN ('curated', 'groq')),
    reviewed_by TEXT,
    reviewed_at TEXT,
    review_decision TEXT CHECK (review_decision IN ('approved', 'rejected')),
    question_bank_version INTEGER NOT NULL DEFAULT 1 CHECK (question_bank_version >= 1)
);

CREATE TABLE IF NOT EXISTS assessment_session_questions (
    session_id TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES assessment_questions(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (session_id, question_id), UNIQUE(session_id, position)
);

CREATE TABLE IF NOT EXISTS assessment_answers (
    session_id TEXT NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES assessment_questions(id),
    selected_choice INTEGER NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    answered_at TEXT NOT NULL,
    PRIMARY KEY (session_id, question_id)
);

CREATE TABLE IF NOT EXISTS mastery_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_reference TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    prior REAL NOT NULL CHECK (prior BETWEEN 0 AND 1),
    observation_posterior REAL NOT NULL CHECK (observation_posterior BETWEEN 0 AND 1),
    next_prior REAL NOT NULL CHECK (next_prior BETWEEN 0 AND 1),
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    parameter_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_learner_concept
ON mastery_history(user_reference, concept_id, id);
"""


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 5000")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize(self) -> None:
        with self.connect() as connection:
            connection.executescript(SCHEMA)
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(assessment_questions)")}
            migrations = {
                "reviewed_by": "ALTER TABLE assessment_questions ADD COLUMN reviewed_by TEXT",
                "reviewed_at": "ALTER TABLE assessment_questions ADD COLUMN reviewed_at TEXT",
                "review_decision": "ALTER TABLE assessment_questions ADD COLUMN review_decision TEXT CHECK (review_decision IN ('approved', 'rejected'))",
                "question_bank_version": "ALTER TABLE assessment_questions ADD COLUMN question_bank_version INTEGER NOT NULL DEFAULT 1 CHECK (question_bank_version >= 1)",
            }
            for column, statement in migrations.items():
                if column not in columns:
                    connection.execute(statement)
            connection.execute("""UPDATE assessment_questions
                SET reviewed_by=COALESCE(reviewed_by, 'curated-bank-maintainers'),
                    reviewed_at=COALESCE(reviewed_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                    review_decision=COALESCE(review_decision, 'approved')
                WHERE source='curated' AND review_status='approved'""")

    def ping(self) -> None:
        with self.connect() as connection:
            connection.execute("SELECT 1").fetchone()
