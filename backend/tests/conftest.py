import importlib
import os
import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def storage(env):
    from test_content_media import FakeStorage

    value = FakeStorage()
    env[0].state.storage = value
    return value


@pytest.fixture
async def env(tmp_path):
    try:
        main = importlib.import_module("app.main")
    except ModuleNotFoundError as exc:
        if exc.name == "app.main":
            pytest.fail("CMMI API has not been implemented")
        raise
    from app.core.config import Settings
    from app.core.security import hash_password
    from app.models import Base, User
    from app.schemas import Role

    database_url = os.environ.get("CMMI_TEST_DATABASE_URL", f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    if database_url.startswith("postgres") and "/cmmi_test" not in database_url:
        raise ValueError("Integration tests require a dedicated cmmi_test database")
    config = Settings(
        _env_file=None,
        environment="development",
        database_url=database_url,
        secret_key="test-secret-with-at-least-32-characters",
        scheduler_enabled=False,
        r2_public_domain="https://media.example.test",
    )
    app = main.create_app(config)
    async with app.state.engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
        await connection.run_sync(Base.metadata.create_all)
    async with app.state.sessions() as db:
        users = [
            User(email=email, password_hash=hash_password("StrongPassword123!"), role=role)
            for email, role in [
                ("admin@example.com", Role.ADMIN),
                ("a@example.com", Role.CREATOR),
                ("b@example.com", Role.CREATOR),
            ]
        ]
        db.add_all(users)
        await db.commit()
        ids = [u.id for u in users]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        headers = []
        for email in ["admin@example.com", "a@example.com", "b@example.com"]:
            result = await client.post(
                "/api/v1/auth/login", json={"email": email, "password": "StrongPassword123!"}
            )
            assert result.status_code == 200, result.text
            headers.append({"Authorization": "Bearer " + result.json()["access_token"]})
        yield app, client, headers, ids
    await app.state.engine.dispose()
