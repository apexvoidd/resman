import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_cors_preflight_standard_localhost(client):
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "content-type, authorization",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_preflight_dynamic_dev_port(client):
    # Test port 3002 (Next.js fallback) and 5173 (Vite)
    for port in [3002, 3003, 5173, 8080]:
        origin = f"http://localhost:{port}"
        response = client.options(
            "/api/v1/health",
            headers={
                "Origin": origin,
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == origin


def test_cors_preflight_127_0_0_1_origin(client):
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:3000"


def test_cors_actual_request_headers(client):
    response = client.get(
        "/health",
        headers={"Origin": "http://localhost:3000"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_vercel_domain(client):
    origin = "https://resman-aqqx.vercel.app"
    response = client.options(
        "/api/v1/guest/session",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type, x-session-token",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    assert response.headers.get("access-control-allow-credentials") == "true"


def test_cors_settings_env_var_parsing(monkeypatch):
    from app.config.settings import Settings

    # Test plain comma-separated string from EnvSettingsSource
    monkeypatch.setenv("CORS_ORIGINS", "https://frontend.example.com,https://admin.example.com")
    s1 = Settings()
    assert s1.CORS_ORIGINS == ["https://frontend.example.com", "https://admin.example.com"]

    # Test JSON string array from EnvSettingsSource
    monkeypatch.setenv("CORS_ORIGINS", '["https://app.render.com"]')
    s2 = Settings()
    assert s2.CORS_ORIGINS == ["https://app.render.com"]


