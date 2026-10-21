"""CMMI Platform — Model Context Protocol (MCP) Server.

Provides AI Agents (Claude Desktop, Claude Code, Cursor, Windsurf) with direct tools to:
- Upload media files directly to Cloudflare R2 via CMMI in 1 step
- List, create, and update contents (drafts, scheduled posts, published)
- Check scheduled posts and detect overdue content
- Sync social post IDs upon publishing
"""

from datetime import datetime, timezone
import json
import mimetypes
import os
from pathlib import Path
from typing import Any, Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import httpx
from mcp.server.fastmcp import FastMCP

# Initialize FastMCP server
mcp = FastMCP(
    name="CMMI Platform Toolkit",
    instructions="""This server provides tools to manage Content and Media in the CMMI platform.
Use cmmi_upload_media to upload local images or videos to Cloudflare R2 before creating content.
Use cmmi_check_schedule to inspect upcoming or overdue scheduled publications.
Use cmmi_create_content to draft or schedule new posts with media attached.
Use cmmi_update_content to edit existing posts.
Use cmmi_sync_published after publishing to social networks (Facebook, TikTok, YouTube).
""",
)

BASE_URL = os.environ.get("CMMI_BASE_URL", "http://localhost:8000").rstrip("/")
API_KEY = os.environ.get("CMMI_API_KEY", "")


def get_headers() -> dict[str, str]:
    headers = {"Content-Type": "application/json"}
    if API_KEY:
        headers["X-API-Key"] = API_KEY
    return headers


def format_error(status: int, detail: Any) -> str:
    return f"Error {status}: {detail}"


@mcp.tool()
async def cmmi_upload_media(file_path: str) -> str:
    """Upload a local image or video file to CMMI (automatically handles Cloudflare R2 direct PUT and confirmation).

    Args:
        file_path: Absolute or relative path to the image or video file on the local machine.
    """
    path = Path(file_path).expanduser().resolve()
    if not path.exists():
        return f"Error: Local file '{file_path}' does not exist."
    if not path.is_file():
        return f"Error: '{file_path}' is a directory, not a file."

    file_size = path.stat().st_size
    mime_type, _ = mimetypes.guess_type(path.name)
    if not mime_type:
        mime_type = "application/octet-stream"

    # Step 1: Request presigned upload URL
    async with httpx.AsyncClient(timeout=60.0) as client:
        req_res = await client.post(
            f"{BASE_URL}/api/v1/media/upload-request",
            headers=get_headers(),
            json={
                "file_name": path.name,
                "mime_type": mime_type,
                "file_size_bytes": file_size,
            },
        )
        if req_res.status_code != 201:
            return format_error(req_res.status_code, req_res.text)

        reservation = req_res.json()
        upload_url = reservation["upload_url"]
        media_info = reservation["media"]
        media_id = media_info["id"]

        # Step 2: PUT binary bytes directly to R2
        with open(path, "rb") as f:
            file_bytes = f.read()

        put_res = await client.put(
            upload_url,
            content=file_bytes,
            headers={"Content-Type": mime_type},
        )
        if put_res.status_code not in (200, 204):
            return f"Error uploading binary to R2: Status {put_res.status_code} - {put_res.text}"

        # Step 3: Confirm upload on CMMI
        confirm_res = await client.post(
            f"{BASE_URL}/api/v1/media/{media_id}/confirm",
            headers=get_headers(),
        )
        if confirm_res.status_code != 200:
            return format_error(confirm_res.status_code, confirm_res.text)

        confirmed_media = confirm_res.json()
        return json.dumps(
            {
                "success": True,
                "media_id": confirmed_media["id"],
                "file_name": confirmed_media["file_name"],
                "public_url": confirmed_media["public_url"],
                "media_type": confirmed_media["media_type"],
                "mime_type": confirmed_media["mime_type"],
                "file_size_bytes": confirmed_media["file_size_bytes"],
            },
            indent=2,
        )


@mcp.tool()
async def cmmi_upload_media_from_url(url: str, file_name: Optional[str] = None) -> str:
    """Download an image or video from a public web URL and store it directly in CMMI R2 storage.

    Args:
        url: Public HTTP/HTTPS URL of the media asset.
        file_name: Optional custom filename with extension (e.g. 'banner.png').
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        res = await client.post(
            f"{BASE_URL}/api/v1/media/upload-from-url",
            headers=get_headers(),
            json={"url": url, "file_name": file_name},
        )
        if res.status_code != 201:
            return format_error(res.status_code, res.text)
        return json.dumps(res.json(), indent=2)


@mcp.tool()
async def cmmi_list_contents(
    status: Optional[str] = None,
    channel: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
) -> str:
    """List contents stored in CMMI with optional filtering.

    Args:
        status: Filter by status: 'DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'.
        channel: Filter by channel: 'facebook', 'tiktok', 'youtube'.
        search: Keyword search in title and body markdown.
        limit: Max items to return (1 to 100, default 20).
        offset: Pagination offset (default 0).
    """
    params: dict[str, Any] = {"limit": limit, "offset": offset}
    if status:
        params["status"] = status
    if channel:
        params["channel"] = channel
    if search:
        params["search"] = search

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(f"{BASE_URL}/api/v1/contents", headers=get_headers(), params=params)
        if res.status_code != 200:
            return format_error(res.status_code, res.text)
        items = res.json()
        return json.dumps(items, indent=2)


@mcp.tool()
async def cmmi_check_schedule(days_ahead: int = 7) -> str:
    """Check scheduled publications in CMMI, highlighting overdue posts and upcoming posts.

    Args:
        days_ahead: Number of days ahead to inspect (default 7).
    """
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(
            f"{BASE_URL}/api/v1/contents",
            headers=get_headers(),
            params={"status": "SCHEDULED", "limit": 100},
        )
        if res.status_code != 200:
            return format_error(res.status_code, res.text)

        items = res.json()
        now_utc = datetime.now(timezone.utc)

        overdue = []
        upcoming = []

        for item in items:
            sched_str = item.get("scheduled_at")
            if not sched_str:
                continue
            try:
                # Parse ISO-8601
                sched_dt = datetime.fromisoformat(sched_str.replace("Z", "+00:00"))
                if sched_dt <= now_utc:
                    overdue.append({**item, "minutes_overdue": int((now_utc - sched_dt).total_seconds() / 60)})
                else:
                    days_diff = (sched_dt - now_utc).total_seconds() / 86400
                    if days_diff <= days_ahead:
                        upcoming.append({**item, "hours_until_post": round((sched_dt - now_utc).total_seconds() / 3600, 1)})
            except Exception:
                continue

        # Sort upcoming by earliest scheduled_at
        upcoming.sort(key=lambda x: x.get("scheduled_at", ""))
        overdue.sort(key=lambda x: x.get("scheduled_at", ""))

        summary = {
            "current_time_utc": now_utc.isoformat(),
            "overdue_count": len(overdue),
            "upcoming_count": len(upcoming),
            "overdue_posts": overdue,
            "upcoming_posts": upcoming,
        }
        return json.dumps(summary, indent=2)


@mcp.tool()
async def cmmi_create_content(
    title: str,
    body: str = "",
    status: str = "DRAFT",
    scheduled_at: Optional[str] = None,
    media_ids: Optional[list[str]] = None,
    fb_post_id: str = "",
    tiktok_post_id: str = "",
    youtube_post_id: str = "",
) -> str:
    """Create a new content item in CMMI (as DRAFT, SCHEDULED, PUBLISHED, or ARCHIVED).

    Args:
        title: Title of the post (1-255 characters).
        body: Body content in Markdown format.
        status: Post status: 'DRAFT', 'SCHEDULED', 'PUBLISHED', or 'ARCHIVED'.
        scheduled_at: Target publication time in ISO-8601 UTC format (e.g. '2026-10-22T08:00:00Z'). Required if status is SCHEDULED.
        media_ids: List of confirmed Media UUIDs to attach in desired display order.
        fb_post_id: Optional Facebook post ID if already published.
        tiktok_post_id: Optional TikTok post ID if already published.
        youtube_post_id: Optional YouTube video ID if already published.
    """
    payload: dict[str, Any] = {
        "title": title,
        "body": body,
        "status": status.upper(),
        "media_ids": media_ids or [],
        "fb_post_id": fb_post_id,
        "tiktok_post_id": tiktok_post_id,
        "youtube_post_id": youtube_post_id,
    }
    if scheduled_at:
        payload["scheduled_at"] = scheduled_at

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(f"{BASE_URL}/api/v1/contents", headers=get_headers(), json=payload)
        if res.status_code != 201:
            return format_error(res.status_code, res.text)
        return json.dumps(res.json(), indent=2)


@mcp.tool()
async def cmmi_update_content(
    content_id: str,
    title: Optional[str] = None,
    body: Optional[str] = None,
    status: Optional[str] = None,
    scheduled_at: Optional[str] = None,
    media_ids: Optional[list[str]] = None,
    fb_post_id: Optional[str] = None,
    tiktok_post_id: Optional[str] = None,
    youtube_post_id: Optional[str] = None,
) -> str:
    """Update an existing content item in CMMI.

    Args:
        content_id: UUID of the content to modify.
        title: New title if changing.
        body: New Markdown body if changing.
        status: New status ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED') if changing.
        scheduled_at: New publication time in ISO-8601 UTC format.
        media_ids: Reordered or updated list of Media UUIDs.
        fb_post_id: Facebook post ID.
        tiktok_post_id: TikTok post ID.
        youtube_post_id: YouTube video ID.
    """
    payload: dict[str, Any] = {}
    if title is not None:
        payload["title"] = title
    if body is not None:
        payload["body"] = body
    if status is not None:
        payload["status"] = status.upper()
    if scheduled_at is not None:
        payload["scheduled_at"] = scheduled_at
    if media_ids is not None:
        payload["media_ids"] = media_ids
    if fb_post_id is not None:
        payload["fb_post_id"] = fb_post_id
    if tiktok_post_id is not None:
        payload["tiktok_post_id"] = tiktok_post_id
    if youtube_post_id is not None:
        payload["youtube_post_id"] = youtube_post_id

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.patch(
            f"{BASE_URL}/api/v1/contents/{content_id}",
            headers=get_headers(),
            json=payload,
        )
        if res.status_code != 200:
            return format_error(res.status_code, res.text)
        return json.dumps(res.json(), indent=2)


@mcp.tool()
async def cmmi_sync_published(
    content_id: str,
    fb_post_id: str = "",
    tiktok_post_id: str = "",
    youtube_post_id: str = "",
) -> str:
    """Mark a scheduled post as PUBLISHED and record the social post IDs.

    This triggers published_at timestamping and activates the media retention lifecycle.

    Args:
        content_id: UUID of the published content.
        fb_post_id: Facebook post ID if published to Facebook.
        tiktok_post_id: TikTok video/post ID if published to TikTok.
        youtube_post_id: YouTube video ID if published to YouTube.
    """
    payload: dict[str, Any] = {
        "status": "PUBLISHED",
        "fb_post_id": fb_post_id,
        "tiktok_post_id": tiktok_post_id,
        "youtube_post_id": youtube_post_id,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.patch(
            f"{BASE_URL}/api/v1/contents/{content_id}",
            headers=get_headers(),
            json=payload,
        )
        if res.status_code != 200:
            return format_error(res.status_code, res.text)
        return json.dumps(res.json(), indent=2)


if __name__ == "__main__":
    mcp.run(transport="stdio")
