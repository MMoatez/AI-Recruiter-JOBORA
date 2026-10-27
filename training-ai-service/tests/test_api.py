from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import main
from app.db import Database
from app.repository import TrainingRepository
from app.schemas import GeneratedRoadmap, SkillGap


def test_analyze_endpoint_persists_live_provenance(tmp_path, monkeypatch):
    database = Database(tmp_path / "test.db")
    database.initialize()
    monkeypatch.setattr(main, "database", database)
    monkeypatch.setattr(main, "repository", TrainingRepository(database))
    gap = SkillGap(
        skill="Docker", requirement_excerpt="Docker required", importance="required",
        status="missing", similarity=0, priority=100, reasoning="Missing",
    )
    roadmap = GeneratedRoadmap.model_validate({
        "title": "Docker roadmap", "summary": "A focused practical roadmap.",
        "weeks": [{"week": 1, "title": "Docker", "skills": ["Docker"], "tasks": [{
            "id": "docker_1", "title": "Containerize app", "objective": "Learn Docker basics",
            "estimated_hours": 2, "exercise": "Create a Dockerfile",
            "deliverables": ["Dockerfile"], "evaluation_criteria": ["Image builds"],
        }]}],
        "projects": [{"title": "Docker app", "description": "A reproducible containerized application.",
            "skills": ["Docker"], "deliverables": ["Repository"],
            "evaluation_criteria": ["Container starts"]}],
    })
    monkeypatch.setattr(main, "SkillGapAnalyzer", lambda _: SimpleNamespace(analyze=lambda *args: [gap]))
    monkeypatch.setattr(
        main, "GroqRoadmapClient",
        lambda _: SimpleNamespace(generate=lambda *args: ("groq-test", roadmap)),
    )
    with TestClient(main.app) as client:
        response = client.post("/api/v1/training/analyze", json={
            "candidate_skills": [{"name": "Git", "level": "beginner", "evidence": []}],
            "job_description": "Docker is required for this engineering position.",
            "career_goal": "Become a mobile engineer", "current_level": "beginner",
            "weekly_hours": 4, "target_weeks": 2, "preferred_language": "en", "free_only": True,
        })
        assert response.status_code == 201
        body = response.json()
        assert body["provenance"] == {
            "provider": "groq", "model": "groq-test", "live_generation": True
        }
        persisted = client.get(f"/api/v1/training/plans/{body['plan_id']}")
        assert persisted.status_code == 200
        assert persisted.json()["provenance"] == "live_ai"
