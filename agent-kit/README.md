# 🤖 CMMI Platform — AI Agent Toolkit

Bộ công cụ kết nối AI (Model Context Protocol - MCP Server, Skill Instructions & Configs) dành cho CMMI Platform.
Tương thích với **Claude Desktop**, **Claude Code**, **Cursor**, **Windsurf**, **Antigravity**, và **ChatGPT Custom GPTs**.

---

## 🚀 Tính năng nổi bật

- **1-Click Media Upload lên Cloudflare R2**: Tự động thực hiện luồng 3 bước (Xin signed URL -> PUT bytes nhị phân -> Confirm) từ đường dẫn file trên ổ cứng của bạn.
- **Quản lý Content**: Tạo, sửa, lên lịch bài viết bằng ngôn ngữ tự nhiên.
- **Kiểm tra lịch đăng (Schedule Audit)**: Tự động phát hiện bài quá hạn chưa đăng và liệt kê danh sách bài sắp đến giờ.
- **Đồng bộ xuất bản (Social Sync)**: Cập nhật link/ID bài đăng từ Facebook, TikTok, YouTube và kích hoạt chu kỳ bảo vệ media retention.

---

## 🛠️ Hướng dẫn Cài đặt & Sử dụng

### Cách 1: Thiết lập cho Claude Desktop (Khuyên Dùng)

1. Cài đặt thư viện phụ thuộc (Python 3.10 trở lên):
   ```bash
   pip install -r requirements.txt
   ```
2. Mở file cấu hình của Claude Desktop:
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
3. Thêm cấu hình CMMI MCP Server:
   ```json
   {
     "mcpServers": {
       "cmmi": {
         "command": "python",
         "args": ["<đường-dẫn-tới-thư-mục-agent-kit>/server.py"],
         "env": {
           "CMMI_BASE_URL": "http://localhost:8000",
           "CMMI_API_KEY": "cmmi_live_your_key_here"
         }
       }
     }
   }
   ```
4. Khởi động lại Claude Desktop. Biểu tượng công cụ 🔨 sẽ xuất hiện với 6 tools của CMMI!

---

### Cách 2: Thiết lập cho ChatGPT Plus (Custom GPTs)

1. Tạo một Custom GPT trong tài khoản ChatGPT của bạn.
2. Tại mục **Instructions**: Sao chép nội dung từ file `configs/custom_gpt_instructions.md`.
3. Tại mục **Actions**:
   - Chọn **Authentication**: Auth Type: `API Key`, Header Name: `X-API-Key`, Auth Token: `<API Key của bạn>`.
   - Bấm **Import from URL**: Nhập `https://<ten-domain-cmmi-cua-ban>/openapi.json`.
4. Bấm **Save / Publish** và bắt đầu trò chuyện!

---

### Cách 3: Thiết lập cho Cursor / Windsurf

1. Thêm MCP server vào mục Settings -> Features -> MCP Servers trong Cursor:
   - Name: `cmmi`
   - Type: `command`
   - Command: `python <đường-dẫn-tới-agent-kit>/server.py`
2. Sao chép nội dung `configs/cursor_rules.md` vào `.cursorrules`.

---

## 📋 Danh sách Công cụ (MCP Tools)

| Tool Name | Mô tả |
| :--- | :--- |
| `cmmi_upload_media` | Upload file ảnh/video cục bộ lên Cloudflare R2 trong 1 bước duy nhất. |
| `cmmi_upload_media_from_url` | Tải ảnh/video từ đường link trên mạng và lưu trực tiếp vào R2. |
| `cmmi_list_contents` | Tra cứu danh sách bài viết (lọc theo DRAFT, SCHEDULED, PUBLISHED...). |
| `cmmi_check_schedule` | Kiểm tra lịch xuất bản, cảnh báo bài quá hạn và bài sắp đến giờ đăng. |
| `cmmi_create_content` | Tạo bài viết mới kèm media và lịch đăng theo giờ UTC. |
| `cmmi_update_content` | Cập nhật tiêu đề, nội dung Markdown, hoặc dời lịch đăng. |
| `cmmi_sync_published` | Đánh dấu bài đã đăng, gắn ID bài viết mạng xã hội (FB, TikTok, YT). |
