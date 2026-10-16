---
name: cmmi-automation
description: >-
  Workflows, API integration patterns, and operational procedures for interacting with
  the CMMI (Content & Media Management Infrastructure) platform.
---

# CMMI Automation Skill

This skill guides coding agents and automation bots on how to interact with, extend, and test the CMMI platform.

## Architecture Highlights
- **Backend**: FastAPI + SQLAlchemy (Async) + Alembic + APScheduler.
- **Frontend**: React + Vite + TypeScript + SASS modules.
- **Storage**: Cloudflare R2 (S3 compatible direct presigned uploads) + PostgreSQL / SQLite.
- **Contract**: `shared/openapi.json` is the single source of truth between backend and frontend.

## Quick API Recipes for Agents

### 1. Polling Scheduled Content
- Endpoint: `GET /api/v1/contents?status=SCHEDULED&limit=50`
- Headers: `X-API-Key: cmmi_live_...`
- Agent checks `scheduled_at` (UTC timestamp) against current UTC time.

### 2. Updating Social Post IDs upon Publishing
- Endpoint: `PATCH /api/v1/contents/{id}`
- Body:
  ```json
  {
    "status": "PUBLISHED",
    "fb_post_id": "...",
    "tiktok_post_id": "...",
    "youtube_post_id": "..."
  }
  ```
- Note: Setting `status: PUBLISHED` automatically stamps `published_at` on the server.

### 3. Media Presigned Upload Lifecycle
1. Request signed URL: `POST /api/v1/media/upload-request` (`file_name`, `mime_type`, `file_size_bytes`).
2. Upload bytes directly to R2: `PUT <upload_url>` with `Content-Type`.
3. Confirm upload: `POST /api/v1/media/{id}/confirm` (Validates HEAD object and transitions from staging).
4. Attach `id` to content `media_ids`.

## Documentation Endpoints
- Scalar Docs: `/docs`
- ReDoc: `/redoc`
- OpenAPI JSON: `/openapi.json`
- LLM Text Spec: `/llms.txt` and `/llms-full.txt`
