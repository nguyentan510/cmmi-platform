# CMMI Platform — AI Agents & Automation Integration Guide

Hướng dẫn tích hợp dành cho AI Agents (LLM Agents, AutoGPT, n8n, Make.com, Custom GPTs, Python Scripts) với nền tảng CMMI.

---

## 1. Triết lý Thiết kế

CMMI (Content & Media Management Infrastructure) đóng vai trò là **kho lưu trữ trung tâm, điều phối trạng thái và quản lý tài nguyên media**. 
- CMMI **không trực tiếp gọi API của Facebook, TikTok, YouTube**.
- Thay vào đó, **AI Agents / Automation Scripts** chịu trách nhiệm:
  1. Quét các bài viết đến lịch xuất bản (`status = SCHEDULED`).
  2. Lấy dữ liệu nội dung, link tải media.
  3. Tiến hành đăng bài lên các nền tảng mạng xã hội tương ứng.
  4. Cập nhật lại ID bài đăng (`fb_post_id`, `tiktok_post_id`, `youtube_post_id`) và chuyển trạng thái sang `PUBLISHED`.

---

## 2. Đường dẫn Tài liệu Dành riêng cho AI (LLM Friendly)

Nếu bạn cấu hình Custom GPT, Agent Tool Use hoặc LangChain / CrewAI:
- **Concise Spec**: `GET /llms.txt` (Dạng văn bản tối giản token).
- **Full Guide**: `GET /llms-full.txt` (Chi tiết đầy đủ các trường hợp ngoại lệ, luồng upload, phân quyền).
- **OpenAPI Tool Contract**: `GET /openapi.json` (Hỗ trợ nạp trực tiếp vào Function Calling của OpenAI/Anthropic/Gemini).

---

## 3. Quy trình Tự động hóa Mẫu (Publishing Workflow)

### Bước 1: Polling bài viết đến hạn đăng
Agent định kỳ gọi API (ví dụ mỗi 5 phút hoặc qua webhook scheduler):

```http
GET /api/v1/contents?status=SCHEDULED&limit=20
X-API-Key: cmmi_live_your_key_here
```

**Lọc các bài có `scheduled_at <= NOW (UTC)`**:
```json
{
  "items": [
    {
      "id": "018f2d5e-...",
      "title": "Ra mắt sản phẩm mới",
      "body_markdown": "Hôm nay chúng tôi rất vui mừng thông báo...",
      "status": "SCHEDULED",
      "scheduled_at": "2026-10-20T02:00:00Z",
      "media": [
        {
          "id": "018f2d5e-...",
          "public_url": "https://media.example.com/media/018f2d5e-.../video.mp4",
          "mime_type": "video/mp4"
        }
      ]
    }
  ]
}
```

### Bước 2: Đăng bài lên mạng xã hội
Agent tải video/ảnh từ `public_url` và gửi nội dung `body_markdown` lên Facebook Graph API, TikTok Content Posting API, hoặc YouTube Data API.

### Bước 3: Cập nhật kết quả vào CMMI
Sau khi đăng thành công và nhận được ID từ các nền tảng:

```http
PATCH /api/v1/contents/018f2d5e-...
X-API-Key: cmmi_live_your_key_here
Content-Type: application/json

{
  "status": "PUBLISHED",
  "fb_post_id": "123456789_987654321",
  "tiktok_post_id": "7123456789012345678",
  "youtube_post_id": "dQw4w9WgXcQ"
}
```

> **Lưu ý:**
> - Khi trạng thái chuyển sang `PUBLISHED`, CMMI tự động đóng dấu thời gian `published_at = NOW (UTC)`.
> - Thời điểm này bắt đầu tính chu kỳ retention dọn dẹp media (mặc định 7 ngày).

---

## 4. Quy trình Agent Tự Động Tạo Nội Dung Mới & Upload Media

Nếu Agent của bạn sinh video/ảnh AI và muốn tự động đẩy vào CMMI:

### 1. Xin Presigned Upload URL:
```http
POST /api/v1/media/upload-request
X-API-Key: cmmi_live_your_key_here
Content-Type: application/json

{
  "file_name": "ai_generated_image.webp",
  "mime_type": "image/webp",
  "file_size_bytes": 1048576
}
```
Phản hồi:
```json
{
  "media_id": "018f2d5e-...",
  "upload_url": "https://r2.cloudflarestorage.com/...",
  "headers": { "Content-Type": "image/webp" },
  "expires_in_seconds": 900
}
```

### 2. PUT trực tiếp file lên `upload_url`:
```http
PUT <upload_url>
Content-Type: image/webp

<binary file content>
```

### 3. Xác nhận hoàn tất upload:
```http
POST /api/v1/media/018f2d5e-.../confirm
X-API-Key: cmmi_live_your_key_here
```

### 4. Tạo bài viết kèm Media vừa xác nhận:
```http
POST /api/v1/contents
X-API-Key: cmmi_live_your_key_here
Content-Type: application/json

{
  "title": "Bản tin AI hôm nay",
  "body_markdown": "Nội dung tóm tắt tin tức thế giới...",
  "status": "SCHEDULED",
  "scheduled_at": "2026-10-21T08:00:00Z",
  "media_ids": ["018f2d5e-..."]
}
```

---

## 5. Xử lý lỗi & Best Practices cho Agent
- **401 Unauthorized**: Key sai, hết hạn hoặc đã bị xóa.
- **403 Forbidden**: Key thiếu scope cần thiết (cần `contents:write`, `media:write`).
- **409 Conflict**: Media chưa được xác nhận (`confirm`) mà đã cố gắn vào Content, hoặc file đã bị dọn dẹp (`is_cleaned = true`).
- **Idempotency**: Khi gọi PATCH trạng thái `PUBLISHED`, Agent nên lưu trạng thái cục bộ để tránh đăng trùng bài nếu gặp network timeout.
