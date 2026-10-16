from datetime import datetime, timedelta, timezone
from uuid import UUID

import pytest

from test_content_media import uploaded


async def published_with(env, media_ids, age=8, status="PUBLISHED"):
    from app.models import Content

    app, client, h, _ = env
    data = {"title": "Retention fixture", "status": status, "media_ids": media_ids}
    if status == "SCHEDULED":
        data["scheduled_at"] = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    result = await client.post("/api/v1/contents", headers=h[1], json=data)
    assert result.status_code == 201, result.text
    if status == "PUBLISHED":
        async with app.state.sessions() as db:
            content = await db.get(Content, UUID(result.json()["id"]))
            content.published_at = datetime.now(timezone.utc) - timedelta(days=age)
            await db.commit()
    return result.json()


async def test_settings_permissions_defaults_validation_and_storage(env, storage):
    _, client, h, _ = env
    assert (await client.get("/api/v1/settings/cleanup", headers=h[1])).status_code == 403
    assert (await client.post("/api/v1/settings/cleanup/trigger", headers=h[1])).status_code == 403
    setting = await client.get("/api/v1/settings/cleanup", headers=h[0])
    assert setting.status_code == 200, setting.text
    assert setting.json()["retention_days"] == 7 and setting.json()["cron_expression"] == "0 2 * * *"
    await uploaded(env, storage)
    assert (await client.get("/api/v1/settings/cleanup", headers=h[0])).json()["active_storage_bytes"] == 20
    assert (
        await client.put("/api/v1/settings/cleanup", headers=h[0], json={"retention_days": 0})
    ).status_code == 422
    updated = await client.put(
        "/api/v1/settings/cleanup",
        headers=h[0],
        json={"auto_clean_media": False, "retention_days": 14, "cron_expression": "30 3 * * *"},
    )
    assert updated.status_code == 200 and updated.json()["retention_days"] == 14
    assert (await client.post("/api/v1/settings/cleanup/trigger", headers=h[0])).json()["skipped"] is True


@pytest.mark.parametrize(
    "protected_status,age", [("DRAFT", 8), ("SCHEDULED", 8), ("ARCHIVED", 8), ("PUBLISHED", 1)]
)
async def test_cleanup_protects_shared_media(env, storage, protected_status, age):
    app, client, h, _ = env
    asset = await uploaded(env, storage)
    await published_with(env, [asset["id"]])
    await published_with(env, [asset["id"]], age=age, status=protected_status)
    response = await client.post("/api/v1/settings/cleanup/trigger", headers=h[0])
    assert response.status_code == 200, response.text
    assert response.json()["deleted_count"] == 0
    assert len(storage.objects) == 1


async def test_cleanup_retains_metadata_partial_failure_and_retry(env, storage):
    from app.models import MediaAsset

    app, client, h, _ = env
    assets = [await uploaded(env, storage), await uploaded(env, storage)]
    content = await published_with(env, [item["id"] for item in assets])
    async with app.state.sessions() as db:
        failed_asset = await db.get(MediaAsset, UUID(assets[1]["id"]))
        failed_key = failed_asset.r2_object_key
    storage.fail_keys.add(failed_key)
    result = await client.post("/api/v1/settings/cleanup/trigger", headers=h[0])
    assert result.status_code == 200, result.text
    assert result.json() == {"deleted_count": 1, "failed_count": 1, "skipped": False}
    async with app.state.sessions() as db:
        ok = await db.get(MediaAsset, UUID(assets[0]["id"]))
        bad = await db.get(MediaAsset, UUID(assets[1]["id"]))
        assert ok.is_cleaned and ok.public_url == ""
        assert not bad.is_cleaned and bad.public_url
    stats = (await client.get("/api/v1/settings/cleanup", headers=h[0])).json()
    assert stats["last_run_at"] and stats["last_deleted_count"] == 1 and stats["active_storage_bytes"] == 20
    assert (
        len((await client.get("/api/v1/contents/" + content["id"], headers=h[1])).json()["media_assets"]) == 2
    )
    storage.fail_keys.clear()
    assert (await client.post("/api/v1/settings/cleanup/trigger", headers=h[0])).json()["deleted_count"] == 1
    assert (await client.post("/api/v1/settings/cleanup/trigger", headers=h[0])).json()["deleted_count"] == 0


async def test_cleanup_failure_preserves_retryable_records(env, storage):
    app, client, h, _ = env
    item = await uploaded(env, storage)
    await published_with(env, [item["id"]])
    storage.fail_all = True
    result = await client.post("/api/v1/settings/cleanup/trigger", headers=h[0])
    assert result.status_code == 200, result.text
    assert result.json()["failed_count"] == 1 and result.json()["deleted_count"] == 0
    assert len(storage.objects) == 1
