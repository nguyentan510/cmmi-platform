# CMMI Platform — API Documentation & Integration Guide

Tài liệu hướng dẫn chi tiết về RESTful API của hệ thống CMMI (Content & Media Management Infrastructure).

---

## 1. Tổng quan & Đường dẫn Tài liệu Trực tuyến

Hệ thống backend FastAPI cung cấp các cổng thông tin tài liệu tự động:

- **Interactive Scalar Reference**: `http://127.0.0.1:8000/docs` (hoặc qua Vite proxy `http://127.0.0.1:5173/docs`)
- **ReDoc Interactive UI**: `http://127.0.0.1:8000/redoc`
- **OpenAPI 3.1 Spec JSON**: `http://127.0.0.1:8000/openapi.json`
- **Tệp Schema tĩnh trong repo**: `shared/openapi.json`
- **AI Agent LLM Spec**: `http://127.0.0.1:8000/llms.txt` và `/llms-full.txt`
- **Trang Help trong ứng dụng**: `http://127.0.0.1:5173/help` (Mục "Help & docs" trên thanh Sidebar)

---

## 2. Xác thực (Authentication)

Hệ thống hỗ trợ 2 cơ chế xác thực:

### 2.1. API Key (Khuyên dùng cho Automation / AI Agents)
- Header: `X-API-Key: cmmi_live_<secret>`
- Đặc điểm:
  - Tạo tại giao diện **API Keys** hoặc qua endpoint `POST /api/v1/api-keys`.
  - Secret chỉ hiển thị **một lần duy nhất** khi tạo; lưu trữ dạng hash SHA-256.
  - Hỗ trợ scoped permissions, ngày hết hạn và thu hồi tức thì (`DELETE /api/v1/api-keys/{id}`).
  - Creator chỉ thao tác trên tài nguyên của chính mình; Admin thao tác toàn quyền.

### 2.2. JWT Bearer Token (Dành cho Web Admin UI)
- Header: `Authorization: Bearer <access_token>`
- Lấy token qua: `POST /api/v1/auth/login` (Body `username`, `password`). Token có thời hạn và được lưu tạm thời trong `sessionStorage`.

---

## 3. Scopes & Phân quyền

Hệ thống sử dụng các scope sau:
- `contents:read`, `contents:write`
- `media:read`, `media:write`
- `keys:read`, `keys:write`
- `users:read`, `users:write` *(Admin only)*
- `settings:read`, `settings:write` *(Admin only)*

---

## 4. Các Endpoint Chính

### 4.1. Nội dung (Contents) — `/api/v1/contents`

| Phương thức | Endpoint | Mô tả |
| :--- | :--- | :--- |
| `GET` | `/api/v1/contents` | Lấy danh sách bài viết (hỗ trợ phân trang `offset`, `limit`, filter `status`, `channel`, `search`). |
| `POST` | `/api/v1/contents` | Tạo bài viết mới (`title`, `body_markdown`, `status`, `scheduled_at`, `media_ids`). |
| `GET` | `/api/v1/contents/{id}` | Lấy chi tiết bài viết. |
| `PATCH` | `/api/v1/contents/{id}` | Cập nhật bài viết (trạng thái, ID mạng xã hội, media). |
| `DELETE` | `/api/v1/contents/{id}` | Xóa bài viết (không xóa file R2 liên quan). |

**Trạng thái nội dung (ContentStatus):**
- `DRAFT`: Bản nháp.
- `SCHEDULED`: Đã lên lịch, chờ Agent lấy đi đăng. Cần cung cấp `scheduled_at` (chuẩn UTC, ví dụ `2026-10-20T02:00:00Z`).
- `PUBLISHED`: Đã xuất bản thành công lên mạng xã hội. Server tự động gắn timestamp `published_at`.
- `ARCHIVED`: Đã lưu trữ.

---

### 4.2. Quản lý Media & Direct Upload R2 — `/api/v1/media`

Hệ thống sử dụng quy trình **Direct Upload qua Presigned URL (15 phút)** để trình duyệt/agent tải trực tiếp lên Cloudflare R2:

1. **Yêu cầu Upload URL**:
   - `POST /api/v1/media/upload-request`
   - Body: `{"file_name": "video.mp4", "mime_type": "video/mp4", "file_size_bytes": 10485760}`
   - Trả về: `media_id`, `upload_url` (signed PUT URL có hạn 900s), `headers`.
2. **Tải dữ liệu lên R2**:
   - Client gọi `PUT` trực tiếp đến `upload_url` với binary data của file và header `Content-Type`.
3. **Xác nhận Upload**:
   - `POST /api/v1/media/{media_id}/confirm`
   - Server kiểm tra HEAD metadata trên R2 (dung lượng, ETag, MIME) và chuyển object từ `staging/` sang thư mục chính.
4. **Gắn vào bài viết**:
   - Đưa `media_id` vào mảng `media_ids` của Content (thứ tự trong mảng là thứ tự hiển thị).

---

### 4.3. Dọn dẹp Media & Lưu trữ (Cleanup Settings)

- `GET /api/v1/settings/cleanup`: Xem cấu hình dọn media tự động (`retention_days`, `cron_expression`, `auto_clean_media`).
- `PUT /api/v1/settings/cleanup`: Cập nhật cấu hình dọn dẹp.
- `POST /api/v1/settings/cleanup/trigger`: Kích hoạt chạy dọn dẹp ngay lập tức.
- **Quy tắc dọn dẹp an toàn**:
  - Chỉ xóa vật lý trên R2 đối với media của các bài `PUBLISHED` đã quá số ngày retention (mặc định 7 ngày).
  - Giữ lại media nếu còn được tham chiếu bởi bất kỳ bài `DRAFT`, `SCHEDULED`, `ARCHIVED` hoặc bài mới xuất bản.
  - Khi dọn dẹp xong, bản ghi database chuyển sang `is_cleaned = true`, `public_url` được xóa nhưng metadata vẫn giữ nguyên cho lịch sử.

---

### 4.4. Quản lý Người dùng & API Keys

- `GET /api/v1/users`: Danh sách người dùng (Admin).
- `POST /api/v1/users`: Tạo creator mới (Admin).
- `GET /api/v1/api-keys`: Danh sách API key đang sở hữu.
- `POST /api/v1/api-keys`: Tạo API key mới.
- `DELETE /api/v1/api-keys/{id}`: Thu hồi key ngay lập tức.
