import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "message": "Restaurant Management API Running",
    }


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://localhost"
    ) as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "app_name" in data


def test_db_url_sslmode_formatting():
    from app.db.session import get_async_db_url_and_args

    render_url = "postgresql://user:pass@dpg-xxxx-a.render.com/restaurant_db?sslmode=require"
    url, connect_args = get_async_db_url_and_args(render_url)
    assert url == "postgresql+asyncpg://user:pass@dpg-xxxx-a.render.com/restaurant_db"
    assert connect_args == {"ssl": True}

