import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.schemas import Plan, Fact, ExtractedFacts, Critique

client = TestClient(app)

def test_health_check():
    """Verify that the health check endpoint returns 200 OK and ready status."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
    assert response.json()["agent_status"] == "ready"

def test_pydantic_schema_validation():
    """Verify strict validation for structured agent outputs."""
    # Test Plan Schema
    plan = Plan(sub_questions=["query 1", "query 2"])
    assert len(plan.sub_questions) == 2

    # Test Fact Schema
    fact = Fact(claim="Test fact", source_url="https://example.com")
    facts_collection = ExtractedFacts(facts=[fact])
    assert len(facts_collection.facts) == 1
    assert facts_collection.facts[0].source_url == "https://example.com"

    # Test Critique Schema
    critique = Critique(is_supported=True, feedback="No hallucinations found.")
    assert critique.is_supported is True