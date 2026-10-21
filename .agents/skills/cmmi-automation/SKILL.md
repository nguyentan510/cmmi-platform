---
name: cmmi-automation
description: Workflows, cURL API integration patterns, multi-agent orchestration roles, and operational procedures for interacting with the CMMI platform.
---

# CMMI Automation & Multi-Agent Orchestration Skill

Skill này hướng dẫn các AI Agent (Antigravity, Cursor, Claude Code, v.v.) vận hành nền tảng CMMI Platform bằng chuẩn cURL RESTful API kết hợp hệ thống kiến thức đa kênh và phân vai Subagent.

## 🧠 Kiến Thức Nghiệp Vụ Cốt Lõi
- **Múi giờ UTC**: Toàn bộ `scheduled_at` phải quy đổi sang `UTC ISO-8601` (`Giờ UTC = Giờ địa phương - 7 tiếng` cho GMT+7).
- **Media Retention**: Không xóa media đang liên kết với `DRAFT`, `SCHEDULED`, `ARCHIVED` hoặc bài mới `PUBLISHED` < 7 ngày.
- **Quy chuẩn kênh**:
  - `FACEBOOK`: Ảnh 1:1, 4:5; Caption 150-350 từ; 3-5 hashtags.
  - `TIKTOK`: Video dọc 9:16 (1080x1920); Caption < 150 ký tự; 4-6 hashtags.
  - `YOUTUBE`: Video ngang 16:9; Shorts 9:16; Title < 70 ký tự; Mô tả có Timestamps.
  - `BLOG`: Banner 16:9; 800-2500 từ định dạng Markdown chuẩn H1, H2, H3.

## 👥 Phân Vai Subagent
1. **👑 Content Lead**: Nhận mục tiêu, chỉ huy chung, báo cáo tổng thể.
2. **🎨 Media Asset Specialist**: Gọi `upload-from-url` hoặc upload 3 bước vào R2 để lấy `media_ids`.
3. **✍️ Copywriter Specialist**: Soạn tiêu đề, nội dung, hashtags chuẩn theo kênh.
4. **⏱️ Schedule Auditor**: Kiểm tra `GET /contents?status=SCHEDULED`, rà soát trùng lịch và bài `OVERDUE`.
5. **🔄 Social Sync Operator**: Ghi nhận `fb_post_id`, `tiktok_post_id`, `youtube_post_id` qua `PATCH /contents/{id}`.

## 🛠️ Bộ Lệnh cURL Nhanh (Động theo biến $CMMI_BASE_URL từ .env)
```bash
# 1. Audit lịch xuất bản
curl -s -X GET "$CMMI_BASE_URL/api/v1/contents?status=SCHEDULED&limit=50" -H "X-API-Key: $CMMI_API_KEY"

# 2. Nạp ảnh từ URL vào R2
curl -s -X POST "$CMMI_BASE_URL/api/v1/media/upload-from-url" \
  -H "X-API-Key: $CMMI_API_KEY" -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/banner.png", "file_name": "banner.png"}'

# 3. Tạo bài viết & Lên lịch (UTC)
curl -s -X POST "$CMMI_BASE_URL/api/v1/contents" \
  -H "X-API-Key: $CMMI_API_KEY" -H "Content-Type: application/json" \
  -d '{"title": "...", "body": "...", "status": "SCHEDULED", "scheduled_at": "2026-10-25T02:00:00Z", "channel": "FACEBOOK", "media_ids": ["..."]}'

# 4. Xác nhận đã xuất bản
curl -s -X PATCH "$CMMI_BASE_URL/api/v1/contents/{id}" \
  -H "X-API-Key: $CMMI_API_KEY" -H "Content-Type: application/json" \
  -d '{"status": "PUBLISHED", "fb_post_id": "..."}'
```
