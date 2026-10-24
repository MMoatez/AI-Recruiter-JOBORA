from fastapi.testclient import TestClient
import pytest

from app import main
from app.assessment_repository import AssessmentRepository
from app.db import Database
from app.schemas import (
    AssessmentAnswerInput, AssessmentCreateRequest, AssessmentSubmitRequest,
    GeneratedQuestionKey, QuestionGenerationRequest,
)


def client_for(tmp_path, monkeypatch):
    database = Database(tmp_path / "assessment.db")
    database.initialize()
    monkeypatch.setattr(main, "database", database)
    monkeypatch.setattr(main, "assessment_repository", AssessmentRepository(database))
    return TestClient(main.app)


def test_questions_do_not_leak_answers_and_submission_is_idempotent(tmp_path, monkeypatch):
    with client_for(tmp_path, monkeypatch) as client:
        created = client.post("/api/v1/training/assessments", json={"skill": "Git"})
        assert created.status_code == 201
        session = created.json()
        assert all("correct_choice" not in q and "explanation" not in q for q in session["questions"])
        answers = [{"question_id": q["id"], "selected_choice": 0} for q in session["questions"]]
        submitted = client.post(f"/api/v1/training/assessments/{session['id']}/submit", json={"answers": answers})
        assert submitted.status_code == 200
        duplicate = client.post(f"/api/v1/training/assessments/{session['id']}/submit", json={"answers": answers})
        assert duplicate.status_code == 409
        assert len(client.get("/api/v1/training/mastery").json()) == 3


def test_learner_histories_are_isolated(tmp_path, monkeypatch):
    with client_for(tmp_path, monkeypatch) as client:
        session = client.post("/api/v1/training/assessments", json={"skill": "Docker", "user_reference": "learner-a"}).json()
        answers = [{"question_id": q["id"], "selected_choice": 0} for q in session["questions"]]
        client.post(f"/api/v1/training/assessments/{session['id']}/submit", json={"user_reference": "learner-a", "answers": answers})
        assert len(client.get("/api/v1/training/mastery?user_reference=learner-a").json()) == 3
        assert client.get("/api/v1/training/mastery?user_reference=learner-b").json() == []


def test_unsupported_skill_uses_no_unreviewed_questions(tmp_path, monkeypatch):
    with client_for(tmp_path, monkeypatch) as client:
        response = client.post("/api/v1/training/assessments", json={"skill": "Unknown framework"})
        assert response.status_code == 404


def test_generated_question_is_pending_and_key_is_not_returned(tmp_path):
    database = Database(tmp_path / "pending.db")
    database.initialize()
    repository = AssessmentRepository(database)
    response = repository.store_pending(QuestionGenerationRequest(skill="Python", concept_id="python:types"),
        GeneratedQuestionKey(prompt="Which value is immutable in standard Python?", choices=["list", "dict", "tuple"], correct_choice=2,
                             explanation="A tuple is immutable after it has been constructed."))
    assert response.review_status == "pending_review"
    assert "correct_choice" not in response.model_dump()
    assert repository.create(type("Request", (), {"skill": "Python", "plan_id": None, "user_reference": "development-user"})()) is None


def test_pending_question_attached_to_session_cannot_affect_mastery(tmp_path):
    database = Database(tmp_path / "unapproved.db")
    database.initialize()
    repository = AssessmentRepository(database)
    session = repository.create(AssessmentCreateRequest(skill="Git"))
    assert session is not None
    pending = repository.store_pending(QuestionGenerationRequest(skill="Git", concept_id="git:pending"),
        GeneratedQuestionKey(prompt="Which pending option should never be scored?", choices=["A", "B", "C"], correct_choice=1,
                             explanation="This item requires an explicit local review first."))
    with database.connect() as connection:
        connection.execute("INSERT INTO assessment_session_questions VALUES (?, ?, ?)", (session.id, pending.id, 3))
    answers = [AssessmentAnswerInput(question_id=q.id, selected_choice=0) for q in session.questions]
    answers.append(AssessmentAnswerInput(question_id=pending.id, selected_choice=1))
    with pytest.raises(PermissionError):
        repository.submit(session.id, AssessmentSubmitRequest(answers=answers))
    with database.connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM assessment_answers").fetchone()[0] == 0
        assert connection.execute("SELECT COUNT(*) FROM mastery_history").fetchone()[0] == 0
        assert connection.execute("SELECT status FROM assessment_sessions WHERE id=?", (session.id,)).fetchone()[0] == "active"


def test_local_review_records_provenance_and_revision(tmp_path):
    database = Database(tmp_path / "review.db")
    database.initialize()
    repository = AssessmentRepository(database)
    pending = repository.store_pending(QuestionGenerationRequest(skill="Python", concept_id="python:types"),
        GeneratedQuestionKey(prompt="Which built-in value is immutable in Python?", choices=["list", "dict", "tuple"], correct_choice=2,
                             explanation="A tuple cannot be changed after construction."))
    assert repository.review_question(pending.id, "approved", "faculty-reviewer") is True
    with database.connect() as connection:
        row = connection.execute("SELECT * FROM assessment_questions WHERE id=?", (pending.id,)).fetchone()
    assert row["review_status"] == "approved"
    assert row["reviewed_by"] == "faculty-reviewer"
    assert row["reviewed_at"]
    assert row["review_decision"] == "approved"
    assert row["question_bank_version"] == 2


def test_training_routes_reject_non_loopback_clients():
    with TestClient(main.app, client=("203.0.113.10", 50000)) as client:
        response = client.post("/api/v1/training/assessments", json={"skill": "Git"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "local_demo_only"
