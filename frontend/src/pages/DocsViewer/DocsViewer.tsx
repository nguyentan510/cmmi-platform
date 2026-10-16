import { ArrowUpRight, BookOpen, Bot, CloudUpload, KeyRound, Leaf } from 'lucide-react';

export default function DocsViewer() {
  const apiBase = import.meta.env.VITE_API_URL || '';
  const docsUrl = apiBase ? `${apiBase}/docs` : '/docs';

  return (
    <div className="docs">
      <div className="docs__hero">
        <BookOpen size={30} strokeWidth={1.3} />
        <span className="eyebrow">A QUICK TOUR</span>
        <h2>
          A little guidance.
          <br />A lot of possibility.
        </h2>
        <p>Quản lý nội dung, media và quy trình xuất bản trong một không gian làm việc.</p>
      </div>
      <div className="docs-grid">
        <article className="panel">
          <span className="docs-icon">
            <CloudUpload size={24} />
          </span>
          <h3>01 · From asset to story</h3>
          <p>
            Upload ảnh hoặc video tại Media library. Trình duyệt tải trực tiếp lên R2; máy chủ xác
            nhận kích thước và MIME trước khi sử dụng. Chọn media khi tạo Content; thứ tự chọn là
            thứ tự hiển thị.
          </p>
          <p>
            Body hỗ trợ văn bản Markdown. Chọn DRAFT để lưu ý tưởng, SCHEDULED kèm thời gian để
            automation xử lý, PUBLISHED sau khi đăng thành công, hoặc ARCHIVED để lưu trữ.
          </p>
        </article>
        <article className="panel">
          <span className="docs-icon">
            <KeyRound size={24} />
          </span>
          <h3>02 · Connect your workflow</h3>
          <p>
            Tạo API key riêng cho từng agent ở API keys, chọn quyền tối thiểu và đặt ngày hết hạn.
            Key chỉ hiện một lần; sao chép ngay và giữ ở nơi an toàn.
          </p>
          <code>X-API-Key: cmmi_live_…</code>
          <p>
            Creator chỉ truy cập tài nguyên của mình. Admin quản lý toàn bộ workspace, tài khoản và
            chính sách dọn media.
          </p>
        </article>
        <article className="panel">
          <span className="docs-icon">
            <Leaf size={24} />
          </span>
          <h3>03 · Keep your library light</h3>
          <p>
            Mặc định giữ file 7 ngày sau khi đăng. Cron chạy 02:00 UTC, tương đương 09:00 Việt Nam.
            Admin có thể bật/tắt, đổi lịch, số ngày giữ hoặc chạy ngay trong Settings.
          </p>
          <p>
            Media dùng chung với bản nháp, bài lên lịch, bài lưu trữ hoặc bài mới đăng sẽ được giữ.
            Khi xóa vật lý thành công, metadata vẫn còn với trạng thái Cleaned và URL được xóa.
          </p>
        </article>
        <article className="panel">
          <span className="docs-icon">
            <Bot size={24} />
          </span>
          <h3>04 · Made for agents, too</h3>
          <p>
            Agent lấy bài qua <code>GET /api/v1/contents?status=SCHEDULED</code>, thực hiện đăng ở
            hệ thống bên ngoài, sau đó cập nhật trạng thái và fb_post_id, tiktok_post_id,
            youtube_post_id qua PUT/PATCH.
          </p>
          <p>
            CMMI lưu dữ liệu và điều phối truy cập; việc đăng lên mạng xã hội do automation của bạn
            thực hiện.
          </p>
        </article>
      </div>
      <div className="docs-links">
        <a className="button button--primary" href={docsUrl} target="_blank" rel="noreferrer">
          Interactive API reference <ArrowUpRight size={16} />
        </a>
        <a
          className="button button--secondary"
          href="/llms.txt"
          target="_blank"
          rel="noreferrer"
        >
          Quick AI spec (/llms.txt) <ArrowUpRight size={16} />
        </a>
        <a
          className="button button--secondary"
          href="/llms-full.txt"
          target="_blank"
          rel="noreferrer"
        >
          Full AI guide <ArrowUpRight size={16} />
        </a>
        <a
          className="button button--secondary"
          href="/openapi.json"
          target="_blank"
          rel="noreferrer"
        >
          OpenAPI 3.1 contract <ArrowUpRight size={16} />
        </a>
      </div>
    </div>
  );
}
