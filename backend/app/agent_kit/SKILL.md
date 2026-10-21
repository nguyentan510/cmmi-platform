---
name: cmmi-agent-kit
description: Manage and automate the CMMI (Content & Media Management Infrastructure) platform. Upload media to Cloudflare R2, create and schedule content, audit publication calendars, and sync social post IDs.
---

# CMMI Platform — Agent Skill

This skill enables Claude to control and interact directly with the CMMI (Content & Media Management Infrastructure) platform.

## 🔑 Authentication & Configuration

When interacting with a CMMI backend instance:
- **Base URL**: Configured via environment variable `CMMI_BASE_URL` (default: `http://localhost:8000` or your production domain, e.g. `https://cmmi-backend.onrender.com`).
- **Header**: All requests MUST include the API Key header:
  ```http
  X-API-Key: cmmi_live_your_api_key_here
  Content-Type: application/json
  ```
- **Timezone**: All scheduled times (`scheduled_at`) MUST be formatted in UTC ISO-8601 strings (e.g. `2026-10-25T14:30:00Z`).

---

## 🛠️ Core Capabilities & API Recipes

### 1. Media Upload (Cloudflare R2 Direct & URL Ingestion)

#### Option A: Direct Ingestion from Public URL
Use this when you have an existing image/video URL on the web:
- **Endpoint**: `POST /api/v1/media/upload-from-url`
- **Request Body**:
  ```json
  {
    "url": "https://images.example.com/art.png",
    "file_name": "custom_name.png"
  }
  ```
- **Response**: Returns media record with `id`, `public_url`, and `mime_type`.

#### Option B: Presigned Direct Upload Lifecycle (3-Step R2 Handshake)
When handling local files or binary streams:
1. **Request Presigned URL**:
   - `POST /api/v1/media/upload-request`
   - Body: `{"file_name": "photo.jpg", "mime_type": "image/jpeg", "file_size_bytes": 102400}`
   - Save `upload_url` and `media.id`.
2. **Upload Binary to R2**:
   - `PUT <upload_url>` with raw binary bytes and `Content-Type: image/jpeg`.
3. **Confirm Upload**:
   - `POST /api/v1/media/{media_id}/confirm`
   - Transitions the media from staging to confirmed.

*Note: Media linked to DRAFT, SCHEDULED, or ARCHIVED posts is protected by CMMI's 7-day retention policy and cannot be accidentally deleted.*

---

### 2. Publication Calendar & Schedule Audit

Check what content is pending, scheduled, or overdue:
- **Endpoint**: `GET /api/v1/contents?status=SCHEDULED&limit=50`
- **Audit Logic**:
  - Compare each item's `scheduled_at` timestamp with current UTC time (`datetime.now(timezone.utc)`).
  - If `scheduled_at <= now`, flag as **OVERDUE** (ready for immediate publishing).
  - If `now < scheduled_at <= now + 24 hours`, list as **UPCOMING**.

---

### 3. Content Creation & Scheduling

Create new articles or social posts:
- **Endpoint**: `POST /api/v1/contents`
- **Request Body**:
  ```json
  {
    "title": "Title of the post",
    "body": "Markdown or text content here...",
    "status": "SCHEDULED",
    "scheduled_at": "2026-10-25T10:00:00Z",
    "channel": "FACEBOOK",
    "tags": ["tech", "ai", "updates"],
    "media_ids": ["uuid-of-media-asset"]
  }
  ```
- Valid `status` values: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.
- Valid `channel` values: `FACEBOOK`, `TIKTOK`, `YOUTUBE`, `BLOG`.

---

### 4. Updating Content

Modify existing posts or reschedule:
- **Endpoint**: `PATCH /api/v1/contents/{content_id}`
- **Request Body**: (Pass only the fields to update)
  ```json
  {
    "title": "Updated Title",
    "scheduled_at": "2026-10-26T08:00:00Z"
  }
  ```

---

### 5. Publishing & Social ID Synchronization

When a post is published to external social platforms, synchronize the IDs back to CMMI:
- **Endpoint**: `PATCH /api/v1/contents/{content_id}`
- **Request Body**:
  ```json
  {
    "status": "PUBLISHED",
    "fb_post_id": "123456789_987654321",
    "tiktok_post_id": "7123456789012345678",
    "youtube_post_id": "dQw4w9WgXcQ"
  }
  ```
- Setting `status: PUBLISHED` automatically sets `published_at` to the current timestamp.

---

## 🧰 MCP Tool Reference (`server.py`)

If running via Model Context Protocol (FastMCP):

| Tool Name | Arguments | Description |
| :--- | :--- | :--- |
| `cmmi_upload_media` | `file_path: str` | Uploads local file directly to Cloudflare R2 in 1 step. |
| `cmmi_upload_media_from_url` | `url: str, file_name: Optional[str]` | Ingests media from web URL directly to R2. |
| `cmmi_list_contents` | `status, channel, search, limit, offset` | Queries content posts with filtering. |
| `cmmi_check_schedule` | `hours_ahead: int = 24` | Audits calendar for overdue and upcoming posts. |
| `cmmi_create_content` | `title, body, status, scheduled_at, channel, tags, media_ids` | Creates draft or scheduled post. |
| `cmmi_update_content` | `content_id, title, body, status, scheduled_at, channel, tags, media_ids` | Updates an existing post. |
| `cmmi_sync_published` | `content_id, fb_post_id, tiktok_post_id, youtube_post_id` | Marks published and stores social network IDs. |

---

## 📖 Specifications & Schemas

- **OpenAPI Schema**: Bundled in `shared/openapi.json` or accessible live at `/openapi.json`.
- **LLM Context Guide**: Live plain text prompt at `/llms.txt` and full reference at `/llms-full.txt`.
