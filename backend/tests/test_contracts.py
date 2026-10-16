import unittest
from datetime import datetime, timezone
from uuid import uuid4


class ContractTests(unittest.TestCase):
    def schemas(self):
        try:
            from app import schemas

            return schemas
        except ModuleNotFoundError:
            self.fail("CMMI contract implementation is missing")

    def test_content_defaults_and_media_order(self):
        s = self.schemas()
        media = [uuid4(), uuid4()]
        value = s.ContentCreate(title="Campaign", media_ids=media)
        self.assertEqual(value.status, "DRAFT")
        self.assertEqual((value.fb_post_id, value.tiktok_post_id, value.youtube_post_id), ("", "", ""))
        self.assertEqual(value.media_ids, media)

    def test_invalid_content_and_dates(self):
        s = self.schemas()
        for payload in (
            {"title": " "},
            {"title": "A", "status": "SCHEDULED"},
            {"title": "A", "scheduled_at": "2026-10-17T10:00:00"},
            {"title": "A", "fb_post_id": None},
            {"title": "A", "media_ids": [str(uuid4())] * 2},
            {"title": "A", "unknown_field": True},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                s.ContentCreate(**payload)
        self.assertEqual(
            s.ContentCreate(title="A", status="SCHEDULED", scheduled_at=datetime.now(timezone.utc)).status,
            "SCHEDULED",
        )

    def test_settings_retention_and_cron(self):
        s = self.schemas()
        self.assertEqual(s.SettingUpdate().retention_days, 7)
        self.assertEqual(s.SettingUpdate().cron_expression, "0 2 * * *")
        for payload in ({"retention_days": 0}, {"retention_days": 366}, {"cron_expression": "broken"}):
            with self.assertRaises(ValueError):
                s.SettingUpdate(**payload)

    def test_upload_accepts_safe_images_and_video_only(self):
        s = self.schemas()
        self.assertEqual(
            s.UploadRequest(file_name="clip.mp4", mime_type="video/mp4", file_size_bytes=10).file_size_bytes,
            10,
        )
        for mime, size in [("image/svg+xml", 2), ("text/html", 2), ("image/png", 0)]:
            with self.assertRaises(ValueError):
                s.UploadRequest(file_name="asset", mime_type=mime, file_size_bytes=size)

    def test_key_scopes_expiry_and_patch_nulls(self):
        s = self.schemas()
        self.assertEqual(
            s.KeyCreate(name="Agent").scopes, ["contents:read", "contents:write", "media:read", "media:write"]
        )
        with self.assertRaises(ValueError):
            s.KeyCreate(name="Agent", scopes=["root"])
        with self.assertRaises(ValueError):
            s.KeyCreate(name="Agent", expires_at="2020-01-01T00:00:00Z")
        for payload in ({"title": None}, {"body": None}, {"media_ids": None}, {"status": None}):
            with self.assertRaises(ValueError):
                s.ContentUpdate(**payload)

    def test_content_response_requires_a_media_collection(self):
        s = self.schemas()
        value = dict(
            id=uuid4(),
            author_id=uuid4(),
            title="A",
            body="",
            status="DRAFT",
            scheduled_at=None,
            published_at=None,
            created_at=datetime.now(timezone.utc),
            fb_post_id="",
            tiktok_post_id="",
            youtube_post_id="",
        )
        with self.assertRaises(ValueError):
            s.ContentRead(**value)


if __name__ == "__main__":
    unittest.main()
