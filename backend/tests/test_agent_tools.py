import io
from unittest.mock import AsyncMock, patch
import zipfile
import pytest


async def test_upload_direct_multipart(env, storage):
    _, client, h, _ = env
    file_bytes = b"fake-png-content-12345"
    files = {"file": ("test_photo.png", file_bytes, "image/png")}
    response = await client.post(
        "/api/v1/media/upload-direct",
        headers={"Authorization": h[1]["Authorization"]},
        files=files,
    )
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["file_name"] == "test_photo.png"
    assert data["mime_type"] == "image/png"
    assert data["upload_confirmed"] is True
    assert "test_photo.png" in data["file_name"]
    assert data["public_url"].startswith("https://media.example.test/")


async def test_upload_direct_invalid_mime_rejected(env, storage):
    _, client, h, _ = env
    files = {"file": ("malicious.exe", b"binary", "application/x-dosexec")}
    response = await client.post(
        "/api/v1/media/upload-direct",
        headers={"Authorization": h[1]["Authorization"]},
        files=files,
    )
    assert response.status_code == 422


async def test_upload_from_url_success(env, storage):
    _, client, h, _ = env
    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 30

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.content = fake_png
    mock_resp.headers = {"content-type": "image/png"}

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        response = await client.post(
            "/api/v1/media/upload-from-url",
            headers={"Authorization": h[1]["Authorization"]},
            json={"url": "https://images.example.com/art.png", "file_name": "custom_art.png"},
        )
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["file_name"] == "custom_art.png"
        assert data["mime_type"] == "image/png"
        assert data["upload_confirmed"] is True
        assert data["file_size_bytes"] == len(fake_png)


async def test_download_agent_kit_zip(env):
    _, client, _, _ = env
    response = await client.get("/api/v1/tools/agent-kit.zip")
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"

    # Verify it is a valid zip archive with the expected files
    zip_bytes = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_bytes, "r") as z:
        names = z.namelist()
        assert any("server.py" in name for name in names)
        assert any("README.md" in name for name in names)
        assert any("requirements.txt" in name for name in names)
        assert any("claude_desktop_config.json" in name for name in names)
        assert any("openapi.json" in name for name in names)

    # Test tolerance for duplicate slashes (e.g. https://domain//api/v1/tools/agent-kit.zip)
    double_slash_resp = await client.get("http://test//api/v1/tools/agent-kit.zip")
    assert double_slash_resp.status_code == 200
    assert double_slash_resp.headers["content-type"] == "application/zip"


