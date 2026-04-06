import importlib
import sys
from pathlib import Path

import pytest


@pytest.fixture
def client(tmp_path, monkeypatch):
    project_root = Path(__file__).resolve().parents[1]
    monkeypatch.setenv("DATABASE_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("SECRET_KEY", "test-secret-key-for-flask-session-123456")
    monkeypatch.setenv("JWT_SECRET_KEY", "test-jwt-secret-key-for-suite-123456")
    monkeypatch.setenv("COOKIE_SECURE", "false")

    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    if "app" in sys.modules:
        del sys.modules["app"]

    app_module = importlib.import_module("app")
    app_module.app.config["TESTING"] = True

    with app_module.app.test_client() as test_client:
        yield test_client


def test_register_and_login_success(client):
    register_response = client.post(
        "/api/register",
        json={"username": "alice", "password": "password123"},
    )
    assert register_response.status_code == 201

    login_response = client.post(
        "/api/login",
        json={"username": "alice", "password": "password123"},
    )
    assert login_response.status_code == 200

    payload = login_response.get_json()
    assert payload["user"]["username"] == "alice"
    assert payload["access_token"]


def test_login_failure(client):
    client.post("/api/register", json={"username": "bob", "password": "password123"})
    response = client.post(
        "/api/login",
        json={"username": "bob", "password": "wrong-password"},
    )

    assert response.status_code == 401
    assert response.get_json()["error"]["message"] == "Invalid username or password."


def test_users_endpoint_requires_token(client):
    response = client.get("/api/users")
    assert response.status_code == 401


def test_users_crud_flow(client):
    client.post("/api/register", json={"username": "adminuser", "password": "password123"})
    login_response = client.post("/api/login", json={"username": "adminuser", "password": "password123"})
    token = login_response.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_response = client.post("/api/register", json={"username": "charlie", "password": "password123"})
    assert create_response.status_code == 201
    created_user_id = create_response.get_json()["user"]["id"]

    list_response = client.get("/api/users", headers=headers)
    assert list_response.status_code == 200
    assert any(item["username"] == "charlie" for item in list_response.get_json()["items"])

    update_response = client.put(
        f"/api/users/{created_user_id}",
        json={"username": "charlie-updated", "password": "newpassword123"},
        headers=headers,
    )
    assert update_response.status_code == 200
    assert update_response.get_json()["user"]["username"] == "charlie-updated"

    delete_response = client.delete(f"/api/users/{created_user_id}", headers=headers)
    assert delete_response.status_code == 200


def test_stats_endpoint_returns_expected_shape(client):
    client.post("/api/register", json={"username": "dana", "password": "password123"})
    login_response = client.post("/api/login", json={"username": "dana", "password": "password123"})
    token = login_response.get_json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    stats_response = client.get("/api/stats", headers=headers)
    assert stats_response.status_code == 200

    payload = stats_response.get_json()
    assert "total_users" in payload
    assert "recent_activity" in payload
    assert "charts" in payload
    assert "insights" in payload
