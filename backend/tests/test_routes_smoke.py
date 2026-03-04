from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)

def test_routes_exist():
    assert client.get("/health").status_code == 200
    assert client.get("/version").status_code == 200

    # Validate route registration without requiring a live DB.
    # Invalid payload should fail at request validation before any DB access.
    assert client.post("/api/v1/auth/login", json={}).status_code == 422
    assert client.post("/api/v1/auth/refresh", json={}).status_code == 422
