from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4


class FakeStorage:
    """External R2 boundary only; real routes and database remain in use."""

    def __init__(self):
        self.objects = {}
        self.fail_keys = set()
        self.fail_all = False

    async def presign(self, key, mime):
        return "https://r2.example.test/" + key + "?signed=1"

    async def head(self, key):
        if key not in self.objects:
            raise OSError("Not uploaded")
        obj = self.objects[key]
        return {"ETag": f'"{obj["ContentLength"]}-{obj["ContentType"]}"', **obj}

    async def put(self, key, body, content_type):
        if self.fail_all or key in self.fail_keys:
            raise OSError("Storage unavailable")
        self.objects[key] = {
            "ContentLength": len(body),
            "ContentType": content_type,
            "Body": body,
            "ETag": f'"{len(body)}-{content_type}"',
        }


    async def promote(self, source, target, etag):
        if (await self.head(source))["ETag"] != etag:
            raise OSError("Source changed")
        self.objects[target] = self.objects[source].copy()

    async def delete(self, keys):
        if self.fail_all:
            raise OSError("Storage unavailable")
        deleted = set(keys) - self.fail_keys
        for key in deleted:
            self.objects.pop(key, None)
        return deleted


async def uploaded(env, storage, owner=1):
    _, client, h, _ = env
    result = await client.post(
        "/api/v1/media/upload-request",
        headers=h[owner],
        json={"file_name": "frame.png", "mime_type": "image/png", "file_size_bytes": 20},
    )
    assert result.status_code == 201, result.text
    result = result.json()
    source_key = result["upload_url"].split("r2.example.test/")[1].split("?")[0]
    storage.objects[source_key] = {"ContentLength": 20, "ContentType": "image/png"}
    confirmed = await client.post("/api/v1/media/" + result["media"]["id"] + "/confirm", headers=h[owner])
    assert confirmed.status_code == 200, confirmed.text
    return confirmed.json()


async def test_content_lifecycle_owner_filters_and_timestamps(env):
    app, client, h, ids = env
    response = await client.post("/api/v1/contents", headers=h[1], json={"title": "Launch"})
    assert response.status_code == 201, response.text
    content = response.json()
    assert content["author_id"] == str(ids[1])
    assert content["status"] == "DRAFT" and content["fb_post_id"] == "" and content["published_at"] is None
    url = "/api/v1/contents/" + content["id"]
    assert (await client.get(url, headers=h[2])).status_code == 404
    assert (await client.put(url, headers=h[2], json={"title": "Stolen"})).status_code == 404
    assert (await client.get("/api/v1/contents", headers=h[2])).json() == []
    assert len((await client.get("/api/v1/contents", headers=h[0])).json()) == 1
    scheduled = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    assert (await client.put(url, headers=h[1], json={"status": "SCHEDULED"})).status_code == 422
    assert (
        await client.put(url, headers=h[1], json={"status": "SCHEDULED", "scheduled_at": scheduled})
    ).status_code == 200
    assert len((await client.get("/api/v1/contents?status=SCHEDULED", headers=h[1])).json()) == 1
    pub = (await client.put(url, headers=h[1], json={"status": "PUBLISHED", "fb_post_id": "fb-42"})).json()
    assert pub["published_at"] is not None
    update = (await client.patch(url, headers=h[1], json={"body": "Edited"})).json()
    assert update["published_at"] == pub["published_at"]
    assert (await client.get("/api/v1/contents?channel=facebook&search=launch", headers=h[1])).json()[0][
        "id"
    ] == content["id"]
    assert (await client.get("/api/v1/contents?channel=tiktok", headers=h[1])).json() == []
    assert (await client.delete(url, headers=h[2])).status_code == 404
    assert (await client.delete(url, headers=h[1])).status_code == 204


async def test_api_key_scope_controls_content_writes(env):
    _, client, h, _ = env
    key = (
        await client.post(
            "/api/v1/api-keys", headers=h[1], json={"name": "reader", "scopes": ["contents:read"]}
        )
    ).json()["key"]
    headers = {"X-API-Key": key}
    assert (await client.get("/api/v1/contents", headers=headers)).status_code == 200
    assert (await client.post("/api/v1/contents", headers=headers, json={"title": "Nope"})).status_code == 403


async def test_upload_confirmation_checks_remote_size_mime_and_owner(env, storage):
    from app.models import MediaAsset

    app, client, h, _ = env
    result = await client.post(
        "/api/v1/media/upload-request",
        headers=h[1],
        json={"file_name": "../../photo.png", "mime_type": "image/png", "file_size_bytes": 20},
    )
    assert result.status_code == 201, result.text
    payload = result.json()
    assert payload["expires_in"] == 900 and payload["headers"] == {"Content-Type": "image/png"}
    media = payload["media"]
    assert media["upload_confirmed"] is False and media["public_url"] == ""
    mid = UUID(media["id"])
    async with app.state.sessions() as db:
        record = await db.get(MediaAsset, mid)
        object_key = payload["upload_url"].split("r2.example.test/")[1].split("?")[0]
        canonical_key = record.r2_object_key
        assert ".." not in object_key
    url = "/api/v1/media/" + str(mid) + "/confirm"
    assert (await client.post(url, headers=h[2])).status_code == 404
    assert (await client.post(url, headers=h[1])).status_code == 409
    storage.objects[object_key] = {"ContentLength": 19, "ContentType": "image/png"}
    assert (await client.post(url, headers=h[1])).status_code == 409
    storage.objects[object_key] = {"ContentLength": 20, "ContentType": "text/html"}
    assert (await client.post(url, headers=h[1])).status_code == 409
    storage.objects[object_key] = {"ContentLength": 20, "ContentType": "image/png"}
    confirmed = await client.post(url, headers=h[1])
    assert confirmed.status_code == 200
    assert confirmed.json()["upload_confirmed"] is True and confirmed.json()["public_url"].endswith(
        canonical_key
    )


async def test_content_attaches_only_confirmed_owned_media_in_order(env, storage):
    _, client, h, _ = env
    one = await uploaded(env, storage)
    two = await uploaded(env, storage)
    foreign = await uploaded(env, storage, owner=2)
    for ids in [[foreign["id"]], [str(uuid4())], [one["id"], one["id"]]]:
        response = await client.post(
            "/api/v1/contents", headers=h[1], json={"title": "Invalid", "media_ids": ids}
        )
        assert response.status_code in [404, 422]
    result = await client.post(
        "/api/v1/contents", headers=h[1], json={"title": "Gallery", "media_ids": [two["id"], one["id"]]}
    )
    assert result.status_code == 201, result.text
    content = result.json()
    assert [m["id"] for m in content["media_assets"]] == [two["id"], one["id"]]
    # A reference anywhere prevents destructive manual deletion.
    assert (await client.delete("/api/v1/media/" + one["id"], headers=h[1])).status_code == 409
    assert (
        await client.put("/api/v1/contents/" + content["id"], headers=h[1], json={"media_ids": []})
    ).status_code == 200
    assert (await client.delete("/api/v1/media/" + one["id"], headers=h[1])).status_code == 204
    assert (await client.get("/api/v1/media?is_cleaned=true", headers=h[1])).json()[0]["id"] == one["id"]
    invalid = await client.post(
        "/api/v1/contents", headers=h[1], json={"title": "Gone", "media_ids": [one["id"]]}
    )
    assert invalid.status_code == 409


async def test_storage_failure_does_not_mark_deleted(env, storage):
    from app.models import MediaAsset

    app, client, h, _ = env
    item = await uploaded(env, storage)
    storage.fail_all = True
    assert (await client.delete("/api/v1/media/" + item["id"], headers=h[1])).status_code == 502
    async with app.state.sessions() as db:
        record = await db.get(MediaAsset, UUID(item["id"]))
        assert not record.is_cleaned and record.public_url


async def test_signed_upload_replay_cannot_replace_confirmed_or_deleted_media(env, storage):
    from app.models import MediaAsset

    app, client, h, _ = env
    reservation = (
        await client.post(
            "/api/v1/media/upload-request",
            headers=h[1],
            json={"file_name": "frame.png", "mime_type": "image/png", "file_size_bytes": 20},
        )
    ).json()
    signed_key = reservation["upload_url"].split("r2.example.test/")[1].split("?")[0]
    storage.objects[signed_key] = {"ContentLength": 20, "ContentType": "image/png"}
    media_id = reservation["media"]["id"]
    confirmed = await client.post(f"/api/v1/media/{media_id}/confirm", headers=h[1])
    assert confirmed.status_code == 200, confirmed.text
    async with app.state.sessions() as db:
        record = await db.get(MediaAsset, UUID(media_id))
        final_key = record.r2_object_key
    storage.objects[signed_key] = {"ContentLength": 9999, "ContentType": "text/html"}
    assert storage.objects[final_key]["ContentLength"] == 20
    assert signed_key != final_key
    assert (await client.post(f"/api/v1/media/{media_id}/confirm", headers=h[1])).status_code == 200
    assert storage.objects[final_key]["ContentLength"] == 20
    assert (await client.delete(f"/api/v1/media/{media_id}", headers=h[1])).status_code == 204
    storage.objects[signed_key] = {"ContentLength": 9999, "ContentType": "text/html"}
    assert final_key not in storage.objects
    assert (await client.post(f"/api/v1/media/{media_id}/confirm", headers=h[1])).status_code == 409
