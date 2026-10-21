# 🧠 CMMI Agent Skill — Chuẩn Hoá Tự Động Hóa (Zero-Dependency)

**CMMI Agent Skill** là bộ kỹ năng điều phối toàn diện dành cho các AI Agent (Claude, ChatGPT, Gemini, Cursor, Antigravity, Claude Code...) vận hành nền tảng **CMMI Platform**.

> [!IMPORTANT]
> **Không cần cài đặt thư viện code (0 `pip install`) · Không cần chạy Server ngầm · Không cần tải tool phức tạp.**  
> Mọi tương tác được thực hiện trực tiếp qua chuẩn **RESTful cURL API** và toàn bộ cấu hình được **móc tự động từ file `.env`**.

---

## 🔑 1. Cấu Hình Duy Nhất Qua File `.env` (Single Source of Truth)

Tất cả các Agent khi hoạt động trong workspace sẽ **tự động đọc cấu hình từ file `.env`**:

```env
# URL của CMMI Platform (điền biến động {BASE-URL}, URL thực tế hoặc "auto" để tự động dò tìm)
CMMI_BASE_URL={BASE-URL}

# API Key của bạn (tạo tại CMMI Platform -> Settings -> API Keys)
CMMI_API_KEY={CMMI-API-KEY}
```

---

## 🚀 2. Cách Sử Dụng Theo Từng Nền Tảng

### A. Trong Cursor, Windsurf, Antigravity, Claude Code (Môi trường có Terminal)
1. Đảm bảo file `.env` đã có `CMMI_BASE_URL` và `CMMI_API_KEY`.
2. Giữ nguyên file [SKILL.md](file:///d:/cmmi-platform/agent-kit/SKILL.md) trong thư mục dự án.
3. Chat trực tiếp với Agent:
   - *"Kiểm tra cho tôi các bài viết sắp đến giờ đăng trên CMMI."*
   - *"Tạo một bài viết mới trên Facebook về chủ đề AI, tìm ảnh nạp vào R2 và lên lịch đăng lúc 9h sáng mai."*
   - Agent sẽ **tự động đọc `.env` và tự động thực thi các lệnh `curl` ngầm** để hoàn thành nhiệm vụ!

### B. Trên Claude.ai Web hoặc ChatGPT Web (Trình duyệt)
1. Sao chép nội dung file [SKILL.md](file:///d:/cmmi-platform/agent-kit/SKILL.md) (hoặc bấm nút **Copy cURL Skill** trên giao diện `/docs` của CMMI).
2. Dán vào mục **Project Knowledge** (trên Claude.ai) hoặc **Custom GPT Instructions** (trên ChatGPT).
3. Khi bạn yêu cầu, Agent sẽ soạn sẵn toàn bộ nội dung bài viết và khối lệnh `curl` chuẩn 100% để bạn chỉ cần **1-Click Copy** dán vào terminal máy tính chạy là xong (hoàn toàn không bị chặn mạng hay lỗi sandbox 403).

---

## 👥 3. Ma Trận 5 Vai Trò Điều Phối Subagent Tự Động

Skill này huấn luyện AI hoạt động như một **"Tòa soạn AI độc lập"**:

| Vai trò Subagent | Trách nhiệm chính |
| :--- | :--- |
| **👑 Content Lead** | Tiếp nhận mục tiêu, chia việc cho các Subagent và báo cáo tổng kết. |
| **🎨 Media Specialist** | Nạp ảnh/video từ mạng vào Cloudflare R2 qua API `upload-from-url` và lấy `media_id`. |
| **✍️ Copywriter Specialist** | Soạn thảo bài viết chuẩn ma trận từng kênh (Facebook, TikTok, YouTube, Blog). |
| **⏱️ Schedule Auditor** | Tra cứu lịch (`GET /contents?status=SCHEDULED`), cảnh báo bài quá hạn, tự động quy đổi múi giờ sang UTC ISO-8601. |
| **🔄 Social Sync Operator** | Gắn Social Post ID (FB, TikTok, YT) sau khi đăng và kích hoạt chu kỳ bảo vệ dữ liệu Media Retention 7 ngày. |

---

## 🛠️ 4. Bảng Tra Cứu Lệnh cURL Nhanh

| Mục đích | Lệnh mẫu cURL (Móc trực tiếp từ biến môi trường) |
| :--- | :--- |
| **Health Check** | `curl -s -X GET "$CMMI_BASE_URL/health"` |
| **Kiểm tra lịch đăng** | `curl -s -X GET "$CMMI_BASE_URL/api/v1/contents?status=SCHEDULED&limit=50" -H "X-API-Key: $CMMI_API_KEY"` |
| **Nạp ảnh vào R2** | `curl -s -X POST "$CMMI_BASE_URL/api/v1/media/upload-from-url" -H "X-API-Key: $CMMI_API_KEY" -H "Content-Type: application/json" -d '{"url":"https://.../img.jpg", "file_name":"img.jpg"}'` |
| **Tạo bài & Lên lịch** | `curl -s -X POST "$CMMI_BASE_URL/api/v1/contents" -H "X-API-Key: $CMMI_API_KEY" -H "Content-Type: application/json" -d '{"title":"...", "status":"SCHEDULED", "scheduled_at":"2026-10-25T02:00:00Z"}'` |
| **Đồng bộ xuất bản** | `curl -s -X PATCH "$CMMI_BASE_URL/api/v1/contents/<ID>" -H "X-API-Key: $CMMI_API_KEY" -H "Content-Type: application/json" -d '{"status":"PUBLISHED", "fb_post_id":"..."}'` |
