# CMMI Studio · UI/UX & Design System Rules

Áp dụng cho toàn bộ thư mục `frontend/` trong dự án CMMI Platform (Content & Media Management Infrastructure).

## 1. Định vị Thương hiệu (Brand Identity Core)
- **Tên thương hiệu**: **CMMI Studio**
- **Định vị**: *The Precision Infrastructure for Human Creators & Autonomous Agents.*
- **Tính cách thương hiệu**: Chuẩn xác, Hiện đại, Điềm tĩnh, Tối giản, Sẵn sàng cho Tự động hóa.
- **Phong cách thị giác**: Sắc nét (Crisp), Không gian thoáng đãng (Airy), Bảng màu Deep Slate & Digital Emerald sang trọng.

## 2. Quy chuẩn Typography (Typography Invariants)
- **Kích thước tối thiểu**: Tuyệt đối **KHÔNG** sử dụng font-size < 11px trong bất kỳ thành phần nào (kể cả caption, badge, footnote, footer).
- **Thang kích thước chuẩn (Type Scale)**:
  - *Caption / Micro-copy / Tag*: 11px - 12px (Font-weight: 500)
  - *Body / Table Cell / Form Input*: 14px (Line-height: 20px, Font-weight: 400 hoặc 500)
  - *Sub-heading / Card Title*: 16px - 18px (Font-weight: 600)
  - *Section Header*: 20px - 24px (Font-weight: 600/700)
  - *Page Title (H1)*: 28px - 32px (Font-weight: 700, Letter-spacing: -0.02em)
- **Font Stack**:
  - Giao diện người dùng: `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
  - Code / API Keys / Hashes: `'JetBrains Mono', 'Cascadia Code', monospace`
  - Không sử dụng font Serif (như Georgia) trong các bảng biểu và giao diện quản trị dữ liệu.

## 3. Quy chuẩn Màu sắc & Trợ năng (Color Palette & WCAG AA)
- Mọi cặp màu Text / Background phải đạt tỷ lệ tương phản tối thiểu **4.5:1** cho regular text và **3:1** cho large text/icons theo chuẩn WCAG 2.1 AA.
- **Bảng màu chủ đạo**:
  - *Primary Brand*: Emerald (`#047857`, Hover: `#065F46`, Light Background: `#ECFDF5`)
  - *Text Main*: Slate 900 (`#0F172A`)
  - *Text Body*: Slate 700 (`#334155`)
  - *Text Muted*: Slate 500 (`#64748B`)
  - *Background Canvas*: Slate 50 (`#F8FAFC`)
  - *Background Surface*: Pure White (`#FFFFFF`)
  - *Borders*: Slate 200 (`#E2E8F0`), Border Strong: Slate 300 (`#CBD5E1`)
  - *Trạng thái Content*:
    - Draft: Indigo (`#6366F1`, Light: `#EEF2FF`)
    - Scheduled: Amber (`#D97706`, Light: `#FEF3C7`)
    - Published: Emerald (`#059669`, Light: `#ECFDF5`)
    - Archived: Slate (`#64748B`, Light: `#F1F5F9`)
  - *Danger*: Red 600 (`#DC2626`, Light: `#FEF2F2`)
- Tuyệt đối tránh sử dụng các sắc độ xám ngả vàng/xanh úa thiếu tương phản (`#849178`, `#97a189`, `#9aa38f`).

## 4. Quy chuẩn Khoảng cách (Spatial System - 8pt Grid)
- Mọi khoảng cách (margin, padding, gap) phải tuân theo hệ thống 8-point grid:
  - `$spacing-1: 4px`
  - `$spacing-2: 8px`
  - `$spacing-3: 12px`
  - `$spacing-4: 16px`
  - `$spacing-5: 20px`
  - `$spacing-6: 24px`
  - `$spacing-8: 32px`
  - `$spacing-10: 40px`
  - `$spacing-12: 48px`
- Không sử dụng các giá trị số lẻ ngẫu hứng (như 27px, 22px, 29px).

## 5. Quy chuẩn Trải nghiệm Tác vụ & Công thái học (UX & Interaction Standards)
- **Feedback mượt mà**: Sử dụng Toast notifications hoặc banners nhẹ nhàng không làm xô lệch bố cục (Zero layout-shift).
- **Trạng thái tải (Loading)**: Sử dụng Skeleton Loading hoặc Loading Spinner có kích thước cân đối, tránh dùng text tải trơn sơ sài.
- **Tính khả dụng (Affordance)**: Mọi ô chọn (checkbox) trong bảng dữ liệu phải phục vụ thao tác chọn hàng loạt (Batch operations) thật, không tạo ô giả lập tĩnh.
- **Bảo tồn Hợp đồng & Kiểm thử**: Mọi chỉnh sửa giao diện và cấu trúc CSS/HTML phải bảo đảm giữ nguyên các thuộc tính `aria-label`, `role`, và các text định danh mà bộ kiểm thử `frontend/src/tests/` và `frontend/e2e/` đang phụ thuộc.
