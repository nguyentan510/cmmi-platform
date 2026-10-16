from datetime import datetime, timedelta, timezone
import hashlib

from sqlalchemy import select


async def test_login_rejects_bad_password_and_anonymous(env):
    app, client, headers, ids = env
    assert (
        await client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "bad"})
    ).status_code == 401
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    me = await client.get("/api/v1/auth/me", headers=headers[1])
    assert me.json()["id"] == str(ids[1])
    assert "password_hash" not in me.json()


async def test_admin_user_crud_and_deactivation(env):
    _, client, h, ids = env
    assert (await client.get("/api/v1/users", headers=h[1])).status_code == 403
    new = {"email": "new@example.com", "password": "AnotherPassword123!"}
    result = await client.post("/api/v1/users", headers=h[0], json=new)
    assert result.status_code == 201
    assert result.json()["role"] == "CREATOR"
    assert (await client.post("/api/v1/users", headers=h[0], json=new)).status_code == 409
    assert (
        await client.patch(f"/api/v1/users/{ids[1]}", headers=h[0], json={"is_active": False})
    ).status_code == 200
    assert (await client.get("/api/v1/auth/me", headers=h[1])).status_code == 401
    assert (
        await client.post(
            "/api/v1/auth/login", json={"email": "a@example.com", "password": "StrongPassword123!"}
        )
    ).status_code == 401
    assert (
        await client.patch(f"/api/v1/users/{ids[0]}", headers=h[0], json={"is_active": False})
    ).status_code == 409


async def test_api_key_once_hashed_owner_scoped_and_revocable(env):
    from app.models import ApiKey

    app, client, h, ids = env
    created = await client.post(
        "/api/v1/api-keys", headers=h[1], json={"name": "Read bot", "scopes": ["contents:read"]}
    )
    assert created.status_code == 201, created.text
    key = created.json()
    assert key["key"].startswith("cmmi_live_")
    async with app.state.sessions() as db:
        record = await db.scalar(select(ApiKey))
        assert record.key_hash == hashlib.sha256(key["key"].encode()).hexdigest()
        assert record.key_hash != key["key"]
    api_headers = {"X-API-Key": key["key"]}
    assert (await client.get("/api/v1/auth/me", headers=api_headers)).json()["id"] == str(ids[1])
    assert (await client.get("/api/v1/users", headers=api_headers)).status_code == 403
    assert (
        await client.post("/api/v1/api-keys", headers=api_headers, json={"name": "Escalate"})
    ).status_code == 403
    listing = (await client.get("/api/v1/api-keys", headers=h[1])).json()
    assert len(listing) == 1 and "key" not in listing[0] and "key_hash" not in listing[0]
    assert (await client.get("/api/v1/api-keys", headers=h[2])).json() == []
    assert (await client.delete("/api/v1/api-keys/" + key["id"], headers=h[2])).status_code == 404
    assert (await client.delete("/api/v1/api-keys/" + key["id"], headers=h[1])).status_code == 204
    assert (await client.get("/api/v1/auth/me", headers=api_headers)).status_code == 401


async def test_expired_keys_and_role_escalation(env):
    from app.models import ApiKey

    app, client, h, _ = env
    assert (
        await client.post("/api/v1/api-keys", headers=h[1], json={"name": "root", "scopes": ["users:write"]})
    ).status_code == 403
    key = (await client.post("/api/v1/api-keys", headers=h[1], json={"name": "bot"})).json()
    async with app.state.sessions() as db:
        record = await db.scalar(select(ApiKey))
        record.expires_at = datetime.now(timezone.utc) - timedelta(seconds=1)
        await db.commit()
    assert (await client.get("/api/v1/auth/me", headers={"X-API-Key": key["key"]})).status_code == 401
