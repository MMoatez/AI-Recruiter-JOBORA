from dataclasses import replace

from fastapi.testclient import TestClient

from app import internal_training
from app.jobora_main import app


def test_jobora_entrypoint_exposes_only_internal_training_routes(monkeypatch):
    monkeypatch.setattr(
        internal_training,
        "settings",
        replace(internal_training.settings, internal_token="test-internal-token"),
    )
    client = TestClient(app)

    health = client.get("/internal/health")
    assert health.status_code == 200
    assert health.json()["persistence"] == "nestjs-mongodb"
    assert client.get("/api/v1/training/mastery").status_code == 404

    body = {"prior": 0.4, "correct": True}
    assert client.post("/internal/training/bkt/update", json=body).status_code == 403
    response = client.post(
        "/internal/training/bkt/update",
        json=body,
        headers={"x-training-internal-token": "test-internal-token"},
    )
    assert response.status_code == 200
    assert response.json()["next_prior"] == 0.78
