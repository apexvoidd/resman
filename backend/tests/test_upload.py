import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.dependencies import get_current_user, get_db
from app.models.staff import User

# Override dependencies for standalone unit testing without database
def mock_user():
    return User(id="admin_01", email="admin@test.com", is_superadmin=True, is_active=True)

async def mock_get_db():
    yield None

app.dependency_overrides[get_current_user] = mock_user
app.dependency_overrides[get_db] = mock_get_db


def test_upload_menu_image_success():
    client = TestClient(app)
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    files = {"file": ("test.png", fake_png, "image/png")}

    response = client.post("/api/v1/menu/items/image", files=files)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "image_url" in data
    assert "/uploads/menu-items/" in data["image_url"]


def test_upload_logo_success(monkeypatch):
    from app.services import settings as settings_service

    async def mock_update_settings(*args, **kwargs):
        pass

    monkeypatch.setattr(settings_service, "update_settings", mock_update_settings)

    client = TestClient(app)
    fake_jpg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00\xff\xdb\x00C\x00"
    files = {"file": ("logo.jpg", fake_jpg, "image/jpg")}

    response = client.post("/api/v1/settings/logo", files=files)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "logo_url" in data
    assert "/uploads/logos/" in data["logo_url"]


def test_upload_invalid_file_type():
    client = TestClient(app)
    files = {"file": ("test.txt", b"hello world", "text/plain")}

    response = client.post("/api/v1/menu/items/image", files=files)
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_supabase_storage_success(monkeypatch):
    from app.config.settings import settings
    import httpx

    monkeypatch.setattr(settings, "SUPABASE_URL", "https://testproj.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_KEY", "test-key-123")
    monkeypatch.setattr(settings, "SUPABASE_BUCKET_NAME", "test-bucket")

    class MockResponse:
        status_code = 200
        text = "OK"

    async def mock_post(*args, **kwargs):
        return MockResponse()

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    client = TestClient(app)
    fake_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    files = {"file": ("test.png", fake_png, "image/png")}

    response = client.post("/api/v1/menu/items/image", files=files)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "image_url" in data
    assert "https://testproj.supabase.co/storage/v1/object/public/test-bucket/menu-items/" in data["image_url"]

