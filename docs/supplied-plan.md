Bản kế hoạch kiến trúc và triển khai hệ thống **Content & Media Management Infrastructure (CMMI)** dưới đây được thiết kế theo hướng **Contract-First (Chuẩn hóa Schema trước khi code)**, tối ưu chi phí vận hành (Zero-Egress với Cloudflare R2, Serverless DB với Neon) và sẵn sàng mở rộng cho các Agent AI hoặc Automation Workflow.

---

## 1. Kiến Trúc Tổng Quan & Tech Stack

Hệ thống vận hành trong mạng nội bộ của Docker Compose, đi ra ngoài internet thông qua Cloudflare Tunnel mà không cần mở port trên Router/Firewall, kết nối trực tiếp tới các dịch vụ Cloud (Neon PostgreSQL và Cloudflare R2).

| Tầng (Layer) | Công nghệ lựa chọn | Vai trò & Lý do sử dụng |
| --- | --- | --- |
| **Backend Core** | Python 3.12+, FastAPI, Poetry | Tốc độ cao, tự động sinh OpenAPI 3.1, quản lý dependency chặt chẽ. |
| **ORM & Migration** | SQLAlchemy 2.0 (Async) + Alembic | Tương tác DB bất đồng bộ với `asyncpg`, quản lý lịch sử thay đổi schema. |
| **Validation** | Pydantic v2 | Xác thực dữ liệu đầu vào/đầu ra cực nhanh, làm lõi cho Contract-First. |
| **Database** | PostgreSQL (Neon Serverless) | Tách biệt compute và storage, tự động scale, hỗ trợ branching cho môi trường dev. |
| **Object Storage** | Cloudflare R2 (Boto3 SDK) | Lưu trữ Image/Video chuẩn S3 API, miễn phí băng thông tải ra (Zero Egress Fee). |
| **Background/Cron** | APScheduler (AsyncIOScheduler) | Chạy tiến trình ngầm ngay trong FastAPI lifecycle để dọn dẹp Media định kỳ. |
| **Frontend UI** | React 18+ (Vite, TypeScript), SASS | Cấu trúc module SASS (`.scss`) chuẩn BEM/7-1, tích hợp sinh code tự động từ OpenAPI. |
| **Ingress / Network** | Cloudflare Tunnel (`cloudflared`) | Expose trực tiếp container FE/BE ra tên miền phụ an toàn, chống DDoS, ẩn IP gốc. |

---

## 2. Thiết Kế Database & Chuẩn Hoá Contracts (Schema-First)

Mục tiêu số 8 yêu cầu **BE và FE nhất quán tuyệt đối**. Quy trình chuẩn là định nghĩa Models tại Backend trước, xuất ra file `openapi.json`, sau đó dùng công cụ tự động sinh ra TypeScript Interfaces và API Client cho React.

### 2.1. Cấu trúc Bảng (SQLAlchemy 2.0 Models)

1. **`users`**:
* `id` (UUID, PK), `email` (String, Unique), `password_hash` (String), `role` (Enum: `ADMIN`, `CREATOR`), `is_active` (Boolean), `created_at` (DateTime).


2. **`api_keys`**:
* `id` (UUID, PK), `user_id` (FK -> `users.id`), `name` (String), `key_prefix` (String, 8 ký tự đầu để hiển thị, vd: `cmmi_live_`), `key_hash` (String, SHA-256), `scopes` (ARRAY of Strings), `expires_at` (DateTime, Nullable), `last_used_at` (DateTime), `is_active` (Boolean).


3. **`media_assets`**:
* `id` (UUID, PK), `uploader_id` (FK -> `users.id`), `file_name` (String), `r2_object_key` (String, Unique), `public_url` (String), `media_type` (Enum: `IMAGE`, `VIDEO`), `mime_type` (String), `file_size_bytes` (BigInteger), `is_cleaned` (Boolean, Default: `False` - đánh dấu đã bị xóa trên R2), `created_at` (DateTime).


4. **`contents`**:
* `id` (UUID, PK), `author_id` (FK -> `users.id`), `title` (String), `body` (Text), `status` (Enum: `DRAFT`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`), `scheduled_at` (DateTime, Nullable), `published_at` (DateTime, Nullable - mốc thời gian để Cron quét dọn Media).
* **Các trường Kênh (Lưu String rỗng mặc định theo yêu cầu):**
* `fb_post_id` (String, Default: `""`)
* `tiktok_post_id` (String, Default: `""`)
* `youtube_post_id` (String, Default: `""`)




5. **`content_media_links`** (Bảng trung gian Nhiều-Nhiều giữa Content và Media):
* `content_id` (FK -> `contents.id`), `media_id` (FK -> `media_assets.id`), `display_order` (Integer).


6. **`system_settings`** (Bảng Singleton lưu cấu hình hệ thống):
* `id` (Integer, PK, cố định = 1), `auto_clean_media` (Boolean, Default: `True`), `retention_days` (Integer, Default: `7`), `cron_expression` (String, Default: `"0 2 * * *"` - chạy lúc 2h sáng mỗi ngày), `updated_at` (DateTime).



### 2.2. Pydantic Contracts (Ví dụ cho Content & Settings)

```python
from datetime import datetime
from enum import Enum
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict

class RoleEnum(str, Enum):
    ADMIN = "ADMIN"
    CREATOR = "CREATOR"

class ContentStatusEnum(str, Enum):
    DRAFT = "DRAFT"
    SCHEDULED = "SCHEDULED"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"

class MediaTypeEnum(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"

# --- MEDIA CONTRACT ---
class MediaAssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    file_name: str
    public_url: str
    media_type: MediaTypeEnum
    file_size_bytes: int
    is_cleaned: bool
    created_at: datetime

# --- CONTENT CONTRACT ---
class ContentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255, description="Tiêu đề bài viết")
    body: str = Field(default="", description="Nội dung chi tiết hoặc kịch bản")
    status: ContentStatusEnum = Field(default=ContentStatusEnum.DRAFT)
    scheduled_at: Optional[datetime] = Field(default=None, description="Thời gian lên lịch đăng (UTC)")

    # Kênh phân phối (Mặc định String rỗng, chưa cần tích hợp sâu)
    fb_post_id: str = Field(default="", description="ID hoặc URL bài đăng Facebook")
    tiktok_post_id: str = Field(default="", description="ID hoặc URL video TikTok")
    youtube_post_id: str = Field(default="", description="ID hoặc URL video YouTube")

class ContentCreate(ContentBase):
    media_ids: List[UUID] = Field(default_factory=list, description="Danh sách ID của Media đính kèm")

class ContentRead(ContentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    author_id: UUID
    published_at: Optional[datetime]
    created_at: datetime
    media_assets: List[MediaAssetRead] = []

# --- SETTINGS CONTRACT ---
class SystemSettingUpdate(BaseModel):
    auto_clean_media: bool = Field(..., description="Bật/tắt tự động dọn R2 storage")
    retention_days: int = Field(default=7, ge=1, le=365, description="Số ngày giữ media sau khi đăng")

```

### 2.3. Quy trình Đồng bộ Schema BE -> FE

* Tại Backend: Viết 1 script nhỏ trong Poetry (`poetry run export-schema`) xuất `app.openapi()` ra file `shared/openapi.json`.
* Tại Frontend: Cài đặt `openapi-typescript` và `openapi-fetch`. Chạy lệnh `npx openapi-typescript ../shared/openapi.json -o src/types/api.d.ts`. Mọi thay đổi ở Pydantic sẽ lập tức báo lỗi Type tại React nếu FE truyền sai tên biến.

---

## 3. Phân Quyền RBAC, Quản Lý API Key & Chuẩn Hoá CRUD

### 3.1. Ma trận Phân quyền (RBAC: Admin vs Creator)

| Nhóm Chức Năng | Endpoint chính | CREATOR | ADMIN |
| --- | --- | --- | --- |
| **Auth & Profile** | `POST /api/v1/auth/login`, `GET /me` | Toàn quyền | Toàn quyền |
| **Content CRUD** | `GET, POST, PUT, DELETE /api/v1/contents` | Chỉ thao tác trên Content **của chính mình** (`author_id == current_user.id`). | Xem, sửa, xóa Content của **tất cả mọi người**. |
| **Media Assets** | `POST /api/v1/media/presigned-url`, `DELETE /media/{id}` | Upload và xóa Media của mình. | Toàn quyền quản lý kho Media chung. |
| **API Keys** | `GET, POST, DELETE /api/v1/api-keys` | Tạo/Xóa API Key cá nhân (Giới hạn quyền theo role Creator). | Quản lý toàn bộ API Key của hệ thống. |
| **System Settings** | `GET, PUT /api/v1/settings/cleanup` | Không có quyền truy cập (`403 Forbidden`). | Toàn quyền cấu hình Cronjob & Retention. |
| **Users Management** | `GET, POST, PATCH /api/v1/users` | Không có quyền truy cập (`403 Forbidden`). | Tạo tài khoản Creator mới, khóa user. |

### 3.2. Cơ chế Xác thực Kép (Dual Authentication: JWT & API Key)

Để phục vụ cả người dùng trên Web UI và các con AI Agent / Script tự động bên ngoài:

* **Web UI (React):** Dùng `Bearer <JWT_Token>` trong header `Authorization`.
* **External / AI Agent:** Dùng header `X-API-Key: cmmi_live_xxxxxxxxxxxx`.
* **Lưu trữ bảo mật API Key:** Khi tạo key, hệ thống sinh chuỗi ngẫu nhiên 32 bytes, trả về **duy nhất 1 lần** cho người dùng copy. Trong Database chỉ lưu bản băm `SHA-256` của key đó. Khi có request đi kèm `X-API-Key`, Dependency của FastAPI sẽ băm key nhận được và so khớp với DB, sau đó ánh xạ ra `User` tương ứng cùng với `Role` của họ.

---

## 4. Hệ Thống Quản Lý Media (Cloudflare R2) & Cronjob Dọn Rác

### 4.1. Luồng Upload Media (Presigned URL Pattern)

Để tránh làm nghẽn cổ chai (bottleneck) tại container FastAPI khi upload file Video dung lượng lớn (vài trăm MB):

1. **Bước 1:** React gọi `POST /api/v1/media/upload-request` gửi lên `file_name`, `mime_type`, `file_size_bytes`.
2. **Bước 2:** FastAPI dùng `boto3` kết nối với Cloudflare R2, sinh ra một **Presigned PUT URL** có hiệu lực trong 15 phút, đồng thời tạo bản ghi nháp trong bảng `media_assets`.
3. **Bước 3:** Trình duyệt của người dùng (React) dùng `axios/fetch` đẩy thẳng luồng byte của file video/image lên R2 thông qua Presigned URL đó.
4. **Bước 4:** Sau khi upload thành công, React gọi `POST /api/v1/media/{id}/confirm` để kích hoạt trạng thái sẵn sàng của Media.

### 4.2. Cơ chế Cronjob Dọn Sạch Media Quá Hạn (Mục tiêu số 6)

* **Trigger:** Khi một Content chuyển trạng thái sang `PUBLISHED`, hệ thống tự động gán `published_at = datetime.now(timezone.utc)`.
* **Lập lịch:** Sử dụng `AsyncIOScheduler` khởi chạy cùng sự kiện `lifespan` của FastAPI.
* **Logic truy vấn & Xóa (Chạy hàng ngày):**
1. Đọc cấu hình từ bảng `system_settings`. Nếu `auto_clean_media == False` -> Dừng job.
2. Nếu `True`, tính mốc thời gian cắt: `cutoff_date = now() - timedelta(days=settings.retention_days)` (mặc định là 7 ngày).
3. Tìm tất cả các `media_assets` có `is_cleaned == False`, đang được gắn với các `contents` có `status == PUBLISHED` và `published_at <= cutoff_date` (Đảm bảo media đó không đồng thời nằm trong một bài `DRAFT` hoặc `SCHEDULED` khác chưa đăng).
4. Gửi lệnh `delete_objects` (Batch Delete) lên Cloudflare R2 để xóa file vật lý, giải phóng dung lượng lưu trữ.
5. Cập nhật `is_cleaned = True` và `public_url = ""` trong DB để giữ lại lịch sử metadata cho bài viết mà không làm gãy liên kết khóa ngoại.
6. Trong trang **Settings của UI Admin**, cung cấp thêm nút **"Run Cleanup Now" (`POST /api/v1/settings/cleanup/trigger`)** để Admin có thể ép chạy dọn dẹp ngay lập tức khi cần.



---

## 5. Hệ Thống Documentation Cho AI và User (Mục tiêu số 4)

Để cả con người (User/Developer) và AI (LLM Agents, MCP, Custom GPTs) đều đọc hiểu và tương tác được với hệ thống một cách mượt mà, hệ thống tài liệu được chia làm 2 nhánh tự động:

### 5.1. Dành cho Con người (User & Frontend Dev)

* **Scalar UI (`/docs`) & ReDoc (`/redoc`):** Thay vì chỉ dùng Swagger UI mặc định khá thô, tích hợp thư viện `scalar-fastapi` để tạo giao diện tài liệu API hiện đại, hỗ trợ dùng thử request và xem cấu trúc Schema trực quan.
* **User Guide tích hợp trong React (`/help`):** Một trang hướng dẫn sử dụng nhanh cách tạo API Key, quy tắc xóa Media sau 7 ngày, và ý nghĩa các trạng thái bài viết.

### 5.2. Dành cho AI Agents (`/llms.txt` & OpenAPI)

* **`GET /llms.txt` & `GET /llms-full.txt`:** Xây dựng một endpoint trả về định dạng Markdown chuẩn `llms.txt` (tiêu chuẩn mới giúp LLM đọc hiểu tài liệu siêu tốc mà không tốn token cho mã HTML thừa).
* Nội dung `/llms.txt` sẽ tóm tắt: Cách truyền `X-API-Key`, luồng tạo Content, cách lấy danh sách bài viết đang lên lịch (`status=SCHEDULED`), và cách cập nhật ngược lại các trường `fb_post_id`, `tiktok_post_id`, `youtube_post_id` sau khi AI/Automation đăng bài xong.


* **Làm giàu Metadata trong FastAPI:** Mọi route đều bắt buộc khai báo `summary`, `description`, và `response_description` rõ ràng trong code. Khi đưa đường dẫn `/openapi.json` cho bất kỳ con AI nào (như Claude, GPT, hoặc n8n/Make AI Agent), AI sẽ hiểu ngay cách gọi hàm (Function Calling / Tool Use).

---

## 6. Kiến Trúc UI Frontend Admin (React + Chuẩn SASS)

### 6.1. Cấu trúc Thư mục SASS (Mô hình 7-1 Rút gọn kết hợp CSS Modules)

Sử dụng gói `sass` chính thức trong Vite, kết hợp biến toàn cục và `@use` (thay cho `@import` đã cũ):

```text
frontend/src/
├── assets/
├── styles/
│   ├── abstracts/
│   │   ├── _variables.scss    # Màu sắc (Dark/Light), Spacing, Breakpoints, Z-index
│   │   ├── _mixins.scss       # Flexbox, Grid, Media Queries, Text Truncate
│   │   └── _functions.scss
│   ├── base/
│   │   ├── _reset.scss        # Chuẩn hóa CSS giữa các trình duyệt
│   │   └── _typography.scss   # Font Inter/Plus Jakarta Sans, Heading sizes
│   ├── components/            # Style dùng chung: _buttons.scss, _badges.scss, _modals.scss
│   ├── layout/                # _sidebar.scss, _header.scss, _grid.scss
│   └── main.scss              # File tổng hợp import vào main.tsx
├── pages/
│   ├── ContentManager/        # Bảng danh sách, Filter theo Kênh/Trạng thái, Modal Tạo/Sửa
│   ├── MediaLibrary/          # Grid hiển thị Video/Ảnh, dung lượng, trạng thái "Đã dọn (Cleaned)"
│   ├── ApiKeys/               # Quản lý Key, nút Copy Key 1 lần
│   ├── Settings/              # Bật/tắt Cronjob, chỉnh số ngày (mặc định 7 ngày), xem dung lượng R2
│   └── DocsViewer/            # Nhúng trực tiếp tài liệu hướng dẫn cho User & AI
├── services/                  # Chứa client tự sinh từ OpenAPI
└── types/
    └── api.d.ts               # File TypeScript sinh tự động từ Pydantic Schema

```

### 6.2. Các Màn Hình Chính (Key Screens)

1. **Content Workspace:** Giao diện dạng bảng (Data Table) kết hợp chế độ xem Lịch (Calendar View). Khi bấm tạo/sửa Content, form sẽ có:
* Input `Title`, Rich Text/Markdown cho `Body`.
* Khu vực kéo thả hoặc chọn từ thư viện `Media Assets` (hỗ trợ preview ảnh và phát thử video trực tiếp từ R2).
* Bộ chọn ngày giờ `Scheduled At`.
* 3 ô input dạng Text cho Kênh: `Facebook Post`, `TikTok Post`, `YouTube Post` (mặc định để trống `""`, cho phép điền tay hoặc để bot điền qua API).


2. **Media Library:** Hiển thị danh sách file trên R2, có bộ lọc `Active` vs `Cleaned (Đã xóa sau 7 ngày)` để người dùng kiểm soát rõ ràng file nào còn lưu trữ, file nào đã được giải phóng.
3. **Settings -> Storage & Cron:** Giao diện gồm nút gạt (Toggle) *"Tự động dọn dẹp Media đã đăng"*, ô nhập số ngày (Mặc định: `7`), hiển thị thời gian lần chạy gần nhất và số lượng file đã giải phóng.

---

## 7. Cấu Trúc Thư Mục Toàn Dự Án & Docker Compose

### 7.1. Cấu trúc Monorepo

```text
cmmi-platform/
├── backend/
│   ├── alembic/               # Quản lý migration database
│   ├── app/
│   │   ├── api/v1/            # Chứa các routers: auth, contents, media, api_keys, settings, docs_ai
│   │   ├── core/              # config.py (Pydantic Settings), security.py, r2_client.py
│   │   ├── db/                # session.py (Neon AsyncEngine), base.py
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic v2 contracts
│   │   ├── tasks/             # media_cleaner.py (APScheduler Cronjob)
│   │   └── main.py            # Khởi tạo FastAPI, Lifespan, CORS
│   ├── pyproject.toml         # Quản lý bằng Poetry
│   └── Dockerfile
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.ts
│   ├── nginx.conf             # Cấu hình Nginx phục vụ bản build React và proxy /api
│   └── Dockerfile
├── shared/
│   └── openapi.json           # Bản hợp đồng (Contract) chung giữa BE và FE
├── .env.example
└── docker-compose.yml

```

### 7.2. Thiết kế `docker-compose.yml` (Tích hợp Cloudflare Tunnel)

Không cần mở bất kỳ port nào (`ports:`) ra máy host nếu bạn đi hoàn toàn qua Cloudflare Tunnel, giúp máy chủ bảo mật tuyệt đối:

```yaml
version: "3.9"

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: cmmi_backend
    restart: unless-stopped
    env_file: .env
    environment:
      - DATABASE_URL=${NEON_DATABASE_URL} # Chuỗi kết nối postgresql+asyncpg://... từ Neon
      - R2_ENDPOINT_URL=https://${CF_ACCOUNT_ID}.r2.cloudflarestorage.com
      - R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}
      - R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}
      - R2_BUCKET_NAME=${R2_BUCKET_NAME}
      - R2_PUBLIC_DOMAIN=${R2_PUBLIC_DOMAIN}
      - SECRET_KEY=${JWT_SECRET_KEY}
    networks:
      - cmmi_net

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: cmmi_frontend
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - cmmi_net

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cmmi_tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - frontend
      - backend
    networks:
      - cmmi_net

networks:
  cmmi_net:
    driver: bridge

```

> **Cấu hình định tuyến trên Cloudflare Zero Trust Dashboard:**
> * Trỏ `cms.yourdomain.com` -> `http://frontend:80`
> * Trỏ `api.yourdomain.com` -> `http://backend:8000` (Hoặc dùng Nginx trong container `frontend` để reverse proxy đường dẫn `/api` và `/docs`, `/llms.txt` thẳng sang `http://backend:8000` nhằm dùng chung 1 domain duy nhất, tránh hoàn toàn lỗi CORS).
>
>

---

## 8. Lộ Trình Triển Khai Từng Bước (Execution Roadmap)

1. **Giai đoạn 1: Khởi tạo Hạ tầng & Chuẩn hóa Contracts (Ngày 1 - 2)**
* Tạo project trên **Neon.tech** (lấy chuỗi kết nối Pooled & Direct) và tạo Bucket trên **Cloudflare R2** (lấy S3 API Token + cấu hình CORS cho phép PUT từ domain của bạn).
* Khởi tạo `backend` với Poetry: `poetry add fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic pydantic-settings boto3 passlib[bcrypt] pyjwt apscheduler`.
* Viết toàn bộ **Pydantic Schemas** và **SQLAlchemy Models**, chạy `alembic revision --autogenerate` để đẩy bảng lên Neon Postgres.
* Xuất file `openapi.json` đầu tiên làm mốc Contract.


2. **Giai đoạn 2: Xây dựng Core Backend, R2 & Cronjob (Ngày 3 - 5)**
* Xây dựng Dependency xác thực kép (JWT + `X-API-Key`) và bộ kiểm tra quyền RBAC (`RoleChecker([RoleEnum.ADMIN])`).
* Hoàn thiện các API CRUD cho `Users`, `API Keys`, `Media Assets` (Presigned URL), `Contents` (với 3 trường `fb_post_id`, `tiktok_post_id`, `youtube_post_id` mặc định `""`), và `Settings`.
* Lập trình module `media_cleaner.py` dùng `APScheduler` quét các bài `PUBLISHED` quá `retention_days` (mặc định 7 ngày) để xóa file trên R2.
* Tạo endpoint `/llms.txt` và tích hợp giao diện tài liệu `/docs`.


3. **Giai đoạn 3: Xây dựng Frontend React + SASS (Ngày 6 - 8)**
* Khởi tạo Vite React TypeScript, cài đặt `sass` và thiết lập kiến trúc thư mục 7-1.
* Chạy lệnh sinh Type tự động từ `openapi.json` của Backend.
* Xây dựng Layout Admin, trang Login, trang Quản lý Content (kèm trình upload trực tiếp lên R2), trang Quản lý API Key, và trang Settings (cấu hình Cron dọn rác 7 ngày).


4. **Giai đoạn 4: Đóng gói Docker & Đưa lên Cloud (Ngày 9 - 10)**
* Viết Multi-stage `Dockerfile` cho Backend (Python slim) và Frontend (Node build -> Nginx alpine).
* Khởi chạy `docker compose up -d`, kết nối Cloudflare Tunnel và kiểm thử toàn bộ luồng từ tạo API Key, dùng API Key đẩy Content lên, đến bấm nút test dọn dẹp Media trên R2.



Bạn muốn bắt tay vào chi tiết hóa phần nào trước tiên: **Mã nguồn đầy đủ của SQLAlchemy Models + Pydantic Schemas (Contract)**, hay **cấu hình `pyproject.toml` + `Dockerfile` chuẩn cho môi trường FastAPI và Cloudflare R2**?
