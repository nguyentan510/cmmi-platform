# Agent Guidelines for CMMI Platform

Hướng dẫn dành cho các AI Agent (Antigravity, Cursor, Claude, Copilot, v.v.) khi phát triển và bảo trì codebase CMMI.

## 1. Nguyên Tắc Cốt Lõi
- **Contract First**: OpenAPI schema tại `shared/openapi.json` là nguồn chân lý duy nhất (Single Source of Truth).
  - Khi sửa backend schema/routes: Chạy `python -m poetry run export-schema` trong `backend`.
  - Khi cập nhật frontend types: Chạy `npm run generate:api` trong `frontend`.
- **Media Retention & R2 Protection**: Không bao giờ xóa file media nếu còn được liên kết bởi các bài viết `DRAFT`, `SCHEDULED`, `ARCHIVED` hoặc bài vừa xuất bản trong thời gian retention (mặc định 7 ngày).
- **Direct Upload Flow**: File không đi qua backend server mà được upload thẳng lên R2 qua Signed PUT URL (15 phút), sau đó server xác nhận qua HEAD metadata ở endpoint `confirm`.

## 2. Cấu Trúc Tài Liệu
- `docs/API_GUIDE.md`: Hướng dẫn RESTful API tổng quan.
- `docs/AGENTS_GUIDE.md`: Hướng dẫn luồng tích hợp cho AI Agents (n8n, Make, social posting).
- `backend/app/api/v1/docs_ai.py`: Phục vụ dynamic `/llms.txt` và `/llms-full.txt`.
- `.agents/rules/cmmi-design-system.md`: Tiêu chuẩn giao diện và thiết kế SASS.
- `.agents/skills/cmmi-automation/SKILL.md`: Workspace skill điều khiển nền tảng CMMI.
