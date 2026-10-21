# CMMI Integration Rules for Cursor / Windsurf / Antigravity

Thêm nội dung sau vào file `.cursorrules` hoặc hướng dẫn dự án:

```markdown
## CMMI Platform Assistant

Bạn có quyền truy cập vào CMMI Platform thông qua MCP Server `cmmi`.
Khi người dùng yêu cầu liên quan đến quản lý nội dung và truyền thông:

1. **Upload Media**:
   - Dùng tool `cmmi_upload_media` truyền đường dẫn file cục bộ (VD: `C:/path/to/video.mp4` hoặc `./banner.png`).
   - Lấy `media_id` trả về để sử dụng cho bài viết.

2. **Kiểm tra lịch & bài viết**:
   - Dùng tool `cmmi_check_schedule` để xem ngay các bài sắp đến hạn hoặc quá hạn.
   - Dùng tool `cmmi_list_contents` để tìm kiếm và lọc bài viết theo từ khóa hoặc trạng thái.

3. **Tạo & Cập nhật bài viết**:
   - Dùng tool `cmmi_create_content` để tạo bài mới.
   - Dùng tool `cmmi_update_content` để sửa tiêu đề, nội dung, hoặc dời lịch đăng.
   - Dùng tool `cmmi_sync_published` để gắn ID bài viết Facebook/TikTok/YouTube khi đã xuất bản.
```
