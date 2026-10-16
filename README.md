# CMMI · Content & Media Management Infrastructure

[![CI](https://github.com/nguyentan510/cmmi-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/nguyentan510/cmmi-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Pre-release open source · MIT.** Hướng dẫn đóng góp: [CONTRIBUTING.md](CONTRIBUTING.md). Báo cáo bảo mật riêng tư: [SECURITY.md](SECURITY.md). Dependencies giữ giấy phép riêng theo [NOTICE.md](NOTICE.md).

Monorepo triển khai theo bản kế hoạch được cung cấp: FastAPI + SQLAlchemy async + Alembic, Neon PostgreSQL, Cloudflare R2, APScheduler, React/TypeScript/Vite/Sass và Cloudflare Tunnel.

## Chức năng

- JWT có thời hạn; API key ngẫu nhiên 32 bytes, chỉ hiển thị secret một lần, lưu SHA-256, có scope, hết hạn, thu hồi và thời gian dùng gần nhất.
- Creator quản lý nội dung/media/key của mình; Admin quản lý toàn bộ tài nguyên, người dùng và cấu hình.
- CRUD nội dung, lọc trạng thái/kênh/tiêu đề, phân trang, chế độ bảng/lịch, nhập Markdown, đính kèm media theo thứ tự. Ba trường ID/URL mạng xã hội mặc định `""`.
- Upload trực tiếp R2 bằng signed PUT 15 phút; xác nhận kích thước/MIME bằng HEAD và chuyển object tạm sang object chính với điều kiện ETag. Video/ảnh có preview; media đã dọn giữ metadata.
- Cron mặc định `0 2 * * *` theo **UTC** (09:00 Việt Nam), retention 7 ngày, có bật/tắt và chạy ngay. Giữ media dùng chung nếu còn bất kỳ tham chiếu nháp, lên lịch, lưu trữ hoặc bài mới đăng. Lỗi xóa từng phần được giữ lại để thử lại.
- Tài liệu & API: [Hướng dẫn API](docs/API_GUIDE.md), [Hướng dẫn cho AI Agents](docs/AGENTS_GUIDE.md), Scalar `/docs`, ReDoc `/redoc`, `/openapi.json`, `/llms.txt`, `/llms-full.txt`, và trang hướng dẫn trong ứng dụng `/help`.
- Client `openapi-fetch` và TypeScript tự sinh từ OpenAPI; kiểm tra drift trong CI.

CMMI lưu lịch và ID bài đăng. Agent/n8n/Make của bạn thực hiện đăng lên Facebook, TikTok và YouTube rồi cập nhật dữ liệu qua API. Ứng dụng không tự đăng lên các nền tảng đó. Xem thêm [quy tắc Agent trong .agents/AGENTS.md](.agents/AGENTS.md).

## Chạy cục bộ trên Windows

Yêu cầu Python 3.12+, Node 24 và npm. Không cần dịch vụ cloud để thử đăng nhập và quản lý nội dung bằng SQLite. Upload cần cấu hình R2 thật.

Clone repository rồi mở PowerShell tại thư mục dự án:

```powershell
git clone https://github.com/nguyentan510/cmmi-platform.git
cd cmmi-platform
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install poetry==2.5.1
$env:VIRTUAL_ENV = (Resolve-Path .venv).Path
$env:PATH = "$env:VIRTUAL_ENV\Scripts;$env:PATH"
cd backend
python -m poetry install
$env:ENVIRONMENT = 'development'
$env:DATABASE_URL = 'sqlite+aiosqlite:///./cmmi.db'
$env:DATABASE_DIRECT_URL = ''
$env:SECRET_KEY = python -c "import secrets; print(secrets.token_urlsafe(48))"
python -m alembic upgrade head
python -m app.bootstrap --email you@example.com
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Bootstrap hỏi mật khẩu (tối thiểu 12 ký tự), chỉ tạo admin đầu tiên và không ghi đè tài khoản. Sau đó tạo người dùng bằng trang Users. Không có tài khoản/mật khẩu mặc định. Không gửi secret thật vào chat hoặc Git.

Mở PowerShell thứ hai trong thư mục `frontend` của dự án:

```powershell
npm ci
npm run dev
```

Truy cập **http://127.0.0.1:5173**. Vite proxy API tới `127.0.0.1:8000`. JWT được giữ trong bộ nhớ; tải lại trang hoặc hết hạn token sẽ yêu cầu đăng nhập lại. `/health` chỉ kiểm tra tiến trình API, không xác nhận Neon/R2 sẵn sàng.

Trên Linux/macOS: dùng `.venv/bin/python` thay cho `.venv\Scripts\python.exe`; cài dependencies bằng Poetry và chạy các module tương tự.

## Cấu hình Neon, R2 và Tunnel

Domain giao diện được chọn cho dự án là `https://cmmi.trenux.site`; media dùng `https://media.trenux.site`. Cấu hình domain trong dự án không tự tạo DNS hoặc Cloudflare Tunnel; cần hoàn thành bước 6 để công khai giao diện.

1. Tạo Neon project/branch dành riêng cho môi trường này. Lấy URL pooled cho `DATABASE_URL`, direct cho `DATABASE_DIRECT_URL`; dùng `postgresql+asyncpg://...?...sslmode=require`. Mã chuẩn hóa `sslmode` cho asyncpg. Migration ưu tiên URL direct.
2. Sao chép `.env.example` thành `.env` ở thư mục gốc; thay toàn bộ placeholder. Tạo `SECRET_KEY` ngẫu nhiên ít nhất 32 ký tự. `.env` đã bị Git bỏ qua. Ứng dụng production yêu cầu PostgreSQL, secret và cấu hình R2 đầy đủ.
3. Tạo bucket R2 và token S3 Object Read & Write chỉ cho bucket đó. Điền endpoint/account, access key, secret key, tên bucket và custom public domain HTTPS.
4. Cấu hình CORS bucket cho đúng origin giao diện. Ví dụ:

```json
[
  {
    "AllowedOrigins": ["https://cmmi.trenux.site"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

5. **Bắt buộc thêm lifecycle rule chỉ cho prefix `staging/`, expire sau 1 ngày.** Upload bỏ dở hoặc replay URL PUT chỉ tạo object tạm; rule này thu hồi chúng. Không đặt rule toàn bucket vì sẽ vượt qua chính sách bảo vệ media dùng chung. Signed URL không cho phép ghi object chính. Xem [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/) và [object lifecycles](https://developers.cloudflare.com/r2/buckets/object-lifecycles/).
6. Tạo Cloudflare Tunnel; cấu hình public hostname `cmmi.trenux.site` → `http://frontend:80`, điền `CLOUDFLARE_TUNNEL_TOKEN`. Nginx phục vụ SPA và proxy API/docs cùng domain. `CORS_ORIGINS` dùng JSON array cho các origin bổ sung nếu cần.

Các bước trên thay đổi dịch vụ cloud và do người vận hành thực hiện. Không có tài nguyên cloud nào được tự tạo bởi mã nguồn hoặc kiểm thử cục bộ.

## Đóng gói và vận hành

Docker Desktop/Engine phải chạy. Compose mặc định **không mở host port**. Không tự chạy migration khi container khởi động.

```powershell
docker compose build
# Chỉ chạy trên database mới hoặc sau khi đã tạo snapshot/backup phù hợp:
docker compose run --rm backend python -m alembic upgrade head
docker compose run --rm -it backend python -m app.bootstrap --email you@example.com
docker compose up -d
docker compose ps
```

Chạy **một backend worker** để một lịch cron có một chủ sở hữu. PostgreSQL advisory transaction lock đồng bộ cleanup với gắn media, cập nhật nội dung và xóa media; local lock phục vụ một process/SQLite. Không tăng worker/replica nếu chưa tách scheduler và phân phối cập nhật cron.

Muốn thử các container qua loopback, không chạy tunnel:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d
```

Frontend: `http://127.0.0.1:8080`; API: `http://127.0.0.1:8000`. Override này vẫn dùng cấu hình cloud trong `.env`; bản SQLite dành cho cách chạy Python phía trên.

Trước thay đổi production, tạo snapshot/branch Neon và giữ image hiện tại để rollback ứng dụng. `alembic downgrade base` **xóa dữ liệu**, chỉ dành cho database thử nghiệm. Xóa object R2 là vĩnh viễn nếu không có bản sao độc lập. Dừng bằng `docker compose down`; database Neon và bucket R2 nằm ngoài Compose.

## Contracts và kiểm thử

Trong `backend`, với môi trường Python đã chuẩn bị:

```powershell
python -m poetry run pytest -q
python -m poetry run ruff check app tests
python -m poetry run export-schema
python -m poetry run export-schema --check
```

Trong `frontend`:

```powershell
npm run generate:api
npm run check:api
npm test
npm run build
npm audit
npx playwright install chromium
npm run test:e2e
```

Browser test tự tạo database tạm, migrate/bootstrap bằng dữ liệu fixture, chạy API tại `127.0.0.1:8011` và Vite tại `127.0.0.1:5174`. Không kết nối R2/Neon. Thông tin đăng nhập trong test chỉ dùng cho database tạm. Hai cổng này phải đang trống. Ảnh bằng chứng nằm ở `frontend/test-results/` sau khi chạy.

Để chạy integration suite trên PostgreSQL **dùng riêng và có thể xóa**, đặt `CMMI_TEST_DATABASE_URL` trỏ tới database tên `cmmi_test`. Fixture sẽ xóa/tạo các bảng ứng dụng trong database đó. CI đã khai báo PostgreSQL service, kiểm tra migration upgrade/downgrade/upgrade, backend, frontend, browser và build container. Cấu hình CI không phải bằng chứng CI đã chạy thành công.

## Phạm vi và trạng thái nghiệm thu

Xem [biên bản nghiệm thu ban đầu](docs/ACCEPTANCE.md), [kiểm tra trước khi công khai](docs/PUBLICATION_AUDIT.md) và [GitHub Actions](https://github.com/nguyentan510/cmmi-platform/actions) để phân biệt kết quả cục bộ, CI và các giới hạn môi trường.

- Calendar và thống kê hiển thị dữ liệu của trang đang lọc (50 mục); phân trang để duyệt tiếp.
- Storage totals dựa trên metadata media đã xác nhận, không phải inventory hoặc hóa đơn R2.
- HTML/SVG không được hỗ trợ; ảnh JPEG/PNG/WebP/GIF/AVIF và video MP4/WebM/QuickTime, tối đa 5 GB cho một signed PUT.
- Khi chuyển sang PUBLISHED, server ghi thời điểm hiện tại. Sửa một bài đang PUBLISHED giữ nguyên thời điểm; chuyển ra rồi đăng lại tạo mốc retention mới.
- Media đã dọn vẫn đính kèm trong lịch sử. Khi chỉ sửa chữ của bài lịch sử, UI giữ nguyên liên kết media; không cho đính kèm mới một media đã dọn.
- Các upload tạm cần lifecycle rule `staging/`. Cron nội dung không xóa object chưa được xác nhận.
