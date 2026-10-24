from app.resource_catalog import ResourceCatalog, load_catalog
from app.schemas import SkillGap
from fastapi.testclient import TestClient
from app.main import app


def gap(skill: str, priority: int = 80) -> SkillGap:
    return SkillGap(
        skill=skill,
        requirement_excerpt=f"{skill} required",
        importance="required",
        status="missing",
        similarity=0,
        priority=priority,
        reasoning="Not demonstrated",
    )


def test_catalog_is_valid_and_verified_records_have_dates():
    resources = load_catalog()
    assert len(resources) >= 12
    assert len({item.id for item in resources}) == len(resources)
    assert all(item.url.startswith("https://") for item in resources)
    assert all(item.verified_at is not None for item in resources if item.verification_status == "verified")


def test_recommendations_cover_mobile_and_devops_scenario():
    resources = ResourceCatalog().recommend(
        [gap("Flutter", 100), gap("Firebase", 90), gap("Git", 75), gap("Docker", 85)],
        "beginner", "en", True,
    )
    ids = {item.id for item in resources}
    assert {"flutter-learning-resources", "firebase-learning", "pro-git", "docker-get-started"} <= ids
    assert all(item.access == "free" for item in resources)


def test_free_filter_and_unknown_skills():
    catalog = ResourceCatalog()
    assert all(item.access == "free" for item in catalog.recommend([gap("AWS")], "beginner", "en", True))
    assert any(item.access == "paid" for item in catalog.recommend([gap("AWS")], "beginner", "en", False))
    assert catalog.recommend([gap("Quantum Basket Weaving")], "advanced", "fr", False) == []


def test_resource_endpoint_returns_only_catalog_records():
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/training/resources",
            params={"skills": "Flutter,Firebase,Git,Docker", "level": "beginner", "language": "fr", "free_only": True},
        )
    assert response.status_code == 200
    body = response.json()
    catalog_ids = {item.id for item in load_catalog()}
    assert body
    assert {item["id"] for item in body} <= catalog_ids
    assert all(item["access"] == "free" for item in body)
