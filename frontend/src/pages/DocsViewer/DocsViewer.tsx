import { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  Bot,
  CalendarCheck,
  Check,
  CloudUpload,
  Copy,
  Cpu,
  Download,
  FileCode,
  KeyRound,
  Layers,
  Leaf,
  Sparkles,
  Terminal,
} from 'lucide-react';
import type { Api } from '../../services/api';

type Tab = 'hub' | 'workflows' | 'api';

interface DocsViewerProps {
  api?: Api;
}

export default function DocsViewer({ api: _api }: DocsViewerProps) {
  const [tab, setTab] = useState<Tab>('hub');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rawApiBase = import.meta.env.VITE_API_URL || window.location.origin;
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';
  const docsUrl = apiBase ? `${apiBase}/docs` : '/docs';
  const downloadUrl = `${apiBase}/api/v1/tools/agent-kit.zip`;
  const openApiUrl = `${apiBase}/openapi.json`;
  const llmsUrl = `${apiBase}/llms.txt`;
  const llmsFullUrl = `${apiBase}/llms-full.txt`;

  const [customServerUrl, setCustomServerUrl] = useState(apiBase || 'http://localhost:8000');


  const [customApiKey, setCustomApiKey] = useState('');

  const activeKeyDisplay = customApiKey.trim() || 'cmmi_live_your_api_key_here';

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        cmmi: {
          command: 'python',
          args: ['<duong-dan-toi-agent-kit>/server.py'],
          env: {
            CMMI_BASE_URL: customServerUrl.trim(),
            CMMI_API_KEY: activeKeyDisplay,
          },
        },
      },
    },
    null,
    2,
  );

  const gptInstructions = `Bạn là CMMI Assistant — Trợ lý điều hành nội dung và quản lý truyền thông kết nối với CMMI Platform.
Nhiệm vụ:
1. Khi người dùng muốn xem lịch hoặc danh sách bài viết: Gọi action GET /api/v1/contents (hoặc kiểm tra status=SCHEDULED).
2. Khi người dùng tạo bài viết mới: Tạo bài qua POST /api/v1/contents với định dạng giờ scheduled_at chuẩn UTC ISO-8601.
3. Khi người dùng cung cấp link ảnh/video từ mạng hoặc DALL-E: Gọi action POST /api/v1/media/upload-from-url để nạp vào Cloudflare R2, rồi lấy media_id gắn vào bài viết.
4. Khi bài viết đã đăng MXH (Facebook, TikTok, YouTube): Gọi PATCH /api/v1/contents/{id} đổi status sang PUBLISHED và gắn Social Post ID tương ứng.`;

  const cursorRulesText = `## CMMI Platform Assistant
Bạn có quyền truy cập vào CMMI Platform thông qua MCP Server cmmi.
Khi người dùng yêu cầu liên quan đến quản lý nội dung:
1. Upload media: Dùng tool cmmi_upload_media với đường dẫn file cục bộ (VD: D:/clip.mp4).
2. Kiểm tra lịch đăng: Dùng cmmi_check_schedule để xem các bài sắp đến hạn hoặc quá hạn.
3. Tạo & sửa bài: Dùng cmmi_create_content và cmmi_update_content.
4. Đồng bộ đã đăng: Dùng cmmi_sync_published để lưu ID bài viết Facebook/TikTok/YouTube.`;

  return (
    <div className="docs">
      {/* Top Navigation Tabs */}
      <div className="docs-nav-tabs">
        <button
          className={`docs-tab-btn ${tab === 'hub' ? 'docs-tab-btn--active' : ''}`}
          onClick={() => setTab('hub')}
        >
          <Bot size={16} />
          <span>AI & Agent Hub (MCP)</span>
          <span className="docs-tab-badge">Hot</span>
        </button>
        <button
          className={`docs-tab-btn ${tab === 'workflows' ? 'docs-tab-btn--active' : ''}`}
          onClick={() => setTab('workflows')}
        >
          <Layers size={16} />
          <span>Quy trình & Kiến trúc</span>
        </button>
        <button
          className={`docs-tab-btn ${tab === 'api' ? 'docs-tab-btn--active' : ''}`}
          onClick={() => setTab('api')}
        >
          <FileCode size={16} />
          <span>API Specs & Contract</span>
        </button>
      </div>

      {/* ===================== TAB 1: AI & AGENT HUB ===================== */}
      {tab === 'hub' && (
        <div className="agent-hub">
          {/* Hero */}
          <div className="docs__hero">
            <Cpu size={32} strokeWidth={1.3} className="hub-hero-icon" />
            <span className="eyebrow">MODEL CONTEXT PROTOCOL · AGENT TOOLKIT</span>
            <h2>
              Điều khiển CMMI bằng AI.
              <br />Từ suy nghĩ đến lịch đăng.
            </h2>
            <p>
              Chỉ cần gọi Skill hoặc MCP Tool: tự động upload ảnh/video từ máy lên Cloudflare R2, tạo
              bản nháp, lên lịch phát hành và kiểm tra lịch đăng theo thời gian thực.
            </p>
          </div>

          {/* Download 1-Click Banner */}
          <div className="agent-download-banner panel">
            <div className="agent-download-banner__left">
              <div className="agent-download-badge">
                <Sparkles size={14} /> Gói Sẵn Sàng Sử Dụng
              </div>
              <h3>CMMI Agent Toolkit (.zip)</h3>
              <p>
                Trọn gói mã nguồn Python MCP Server, bộ hướng dẫn chi tiết, các file config mẫu cho
                Claude Desktop, ChatGPT Custom GPT và Cursor IDE.
              </p>
              <div className="agent-download-tags">
                <span className="agent-tag">SKILL.md (Claude Skill)</span>
                <span className="agent-tag">server.py (FastMCP)</span>
                <span className="agent-tag">claude_desktop_config.json</span>
                <span className="agent-tag">custom_gpt_instructions.md</span>
                <span className="agent-tag">shared/openapi.json</span>
              </div>
            </div>
            <div className="agent-download-banner__right">
              <a
                className="button button--primary button--large agent-download-btn"
                href={downloadUrl}
                download="cmmi-agent-kit.zip"
              >
                <Download size={18} /> Tải Toolkit (.zip)
              </a>
              <small>Tải trực tiếp từ server CMMI</small>
            </div>
          </div>

          {/* Quick Config Ingestion Bar */}
          <div className="agent-config-bar panel">
            <div className="agent-config-bar__header">
              <Terminal size={18} />
              <h4>Trình Sinh Cấu Hình Tự Động (Live Config Generator)</h4>
            </div>
            <p className="agent-config-bar__desc">
              Nhập API Key và Domain của bạn để mã cấu hình bên dưới tự động cập nhật ngay lập tức:
            </p>
            <div className="agent-config-inputs">
              <div className="agent-input-field">
                <label>CMMI Base URL:</label>
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder="http://localhost:8000"
                />
              </div>
              <div className="agent-input-field">
                <label>API Key của bạn:</label>
                <input
                  type="text"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  placeholder="cmmi_live_..."
                />
              </div>
            </div>
          </div>

          {/* Quickstart 3 Platforms */}
          <div className="agent-platforms-grid">
            {/* Platform 1: Claude Web & Desktop */}
            <div className="panel platform-card">
              <div className="platform-card__header">
                <div className="platform-badge platform-badge--claude">Claude (Web Skill & Desktop)</div>
                <button
                  className="icon-copy-btn"
                  title="Sao chép cấu hình JSON"
                  onClick={() => copyToClipboard(claudeConfigJson, 'claude')}
                >
                  {copiedKey === 'claude' ? (
                    <>
                      <Check size={14} /> Đã sao chép
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy JSON
                    </>
                  )}
                </button>
              </div>
              <h4>1. Claude (Skill Upload & Desktop MCP)</h4>
              <p>
                <strong>Cách A — Upload Skill lên Claude.ai Web:</strong><br />
                Vào <strong>Settings ➔ Skills ➔ Upload a skill</strong> rồi tải trực tiếp file <code>cmmi-agent-kit.zip</code> lên (đã có sẵn <code>SKILL.md</code> ở gốc file zip theo chuẩn Anthropic).
              </p>
              <p style={{ marginTop: '0.6rem' }}>
                <strong>Cách B — Claude Desktop & Code (MCP Stdio):</strong>
              </p>
              <div className="code-block-wrapper">
                <pre>
                  <code>{claudeConfigJson}</code>
                </pre>
              </div>
              <ol className="platform-steps">
                <li>
                  Giải nén file zip và chạy <code>pip install -r requirements.txt</code>.
                </li>
                <li>
                  Dán khối JSON trên vào <code>%APPDATA%\Claude\claude_desktop_config.json</code>.
                </li>
                <li>Khởi động lại Claude Desktop để nhận 6 tools của CMMI.</li>
              </ol>
            </div>

            {/* Platform 2: ChatGPT Custom GPTs */}
            <div className="panel platform-card">
              <div className="platform-card__header">
                <div className="platform-badge platform-badge--gpt">ChatGPT Plus</div>
                <div className="platform-card__actions">
                  <button
                    className="icon-copy-btn"
                    onClick={() => copyToClipboard(openApiUrl, 'openapi-url')}
                  >
                    {copiedKey === 'openapi-url' ? <Check size={14} /> : <Copy size={14} />} Copy
                    URL
                  </button>
                  <button
                    className="icon-copy-btn"
                    onClick={() => copyToClipboard(gptInstructions, 'gpt-prompt')}
                  >
                    {copiedKey === 'gpt-prompt' ? <Check size={14} /> : <Copy size={14} />} Copy
                    Prompt
                  </button>
                </div>
              </div>
              <h4>2. ChatGPT Custom GPT (GPT Actions)</h4>
              <p>
                Tích hợp trực tiếp vào ChatGPT Web thông qua chuẩn OpenAPI 3.1 Function Calling:
              </p>
              <div className="code-block-wrapper">
                <pre>
                  <code>{openApiUrl}</code>
                </pre>
              </div>
              <ol className="platform-steps">
                <li>
                  Trong ChatGPT, tạo <strong>Custom GPT</strong> ➔ mục <strong>Actions</strong>.
                </li>
                <li>
                  Bấm <strong>Import from URL</strong> và dán đường link OpenAPI ở trên.
                </li>
                <li>
                  Chọn Authentication: <code>API Key</code> ➔ Header Name: <code>X-API-Key</code>.
                </li>
                <li>
                  Bấm <strong>Copy Prompt</strong> ở trên và dán vào ô <strong>Instructions</strong>
                  .
                </li>
              </ol>
            </div>

            {/* Platform 3: Cursor & Antigravity */}
            <div className="panel platform-card">
              <div className="platform-card__header">
                <div className="platform-badge platform-badge--cursor">Cursor / Antigravity</div>
                <button
                  className="icon-copy-btn"
                  onClick={() => copyToClipboard(cursorRulesText, 'cursor')}
                >
                  {copiedKey === 'cursor' ? (
                    <>
                      <Check size={14} /> Đã sao chép
                    </>
                  ) : (
                    <>
                      <Copy size={14} /> Copy Rules
                    </>
                  )}
                </button>
              </div>
              <h4>3. Cursor, Windsurf & AI IDEs</h4>
              <p>Điều khiển nền tảng CMMI ngay trong thanh chat của trình soạn thảo mã nguồn:</p>
              <div className="code-block-wrapper">
                <pre>
                  <code>{cursorRulesText}</code>
                </pre>
              </div>
              <ol className="platform-steps">
                <li>
                  Thêm MCP server trong Settings Cursor: Command{' '}
                  <code>python &lt;agent-kit&gt;/server.py</code>.
                </li>
                <li>
                  Dán nội dung Rules trên vào file <code>.cursorrules</code> của workspace.
                </li>
              </ol>
            </div>
          </div>

          {/* Tools Showcase Table */}
          <div className="panel tools-showcase">
            <div className="tools-showcase__header">
              <BookOpen size={20} />
              <h4>Bảng Tra Cứu 6 Công Cụ (MCP Tools Reference)</h4>
            </div>
            <div className="tools-table-wrapper">
              <table className="tools-table">
                <thead>
                  <tr>
                    <th>Tên Tool</th>
                    <th>Tham số chính</th>
                    <th>Mô tả hoạt động</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <code>cmmi_upload_media</code>
                    </td>
                    <td>
                      <code>file_path</code>
                    </td>
                    <td>
                      Đọc file nhị phân từ ổ cứng, xin presigned URL, PUT trực tiếp lên Cloudflare R2
                      và xác nhận confirm trong 1 bước duy nhất.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>cmmi_check_schedule</code>
                    </td>
                    <td>
                      <code>days_ahead=7</code>
                    </td>
                    <td>
                      Quét toàn bộ bài viết đến hạn đăng, tự động tính số phút quá hạn và phân loại
                      bài sắp đăng theo thứ tự ưu tiên.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>cmmi_create_content</code>
                    </td>
                    <td>
                      <code>title, body, status, scheduled_at, media_ids</code>
                    </td>
                    <td>
                      Tạo bài viết mới (DRAFT hoặc SCHEDULED). Tự động chuẩn hóa thời gian ISO-8601
                      UTC.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>cmmi_update_content</code>
                    </td>
                    <td>
                      <code>content_id, title, body, status, ...</code>
                    </td>
                    <td>Chỉnh sửa nội dung bài viết, cập nhật danh sách media hoặc dời lịch đăng.</td>
                  </tr>
                  <tr>
                    <td>
                      <code>cmmi_sync_published</code>
                    </td>
                    <td>
                      <code>content_id, fb_post_id, tiktok_post_id, ...</code>
                    </td>
                    <td>
                      Đánh dấu bài viết đã xuất bản thành công lên mạng xã hội và kích hoạt chu kỳ
                      bảo vệ media retention.
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <code>cmmi_upload_media_from_url</code>
                    </td>
                    <td>
                      <code>url, file_name</code>
                    </td>
                    <td>
                      Tải ảnh/video từ một liên kết web công khai (hoặc ảnh sinh từ DALL-E) và lưu
                      trực tiếp vào Cloudflare R2.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================== TAB 2: WORKFLOWS & ARCHITECTURE ===================== */}
      {tab === 'workflows' && (
        <div className="docs-workflows">
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
                Upload ảnh hoặc video tại Media library. Trình duyệt tải trực tiếp lên R2; máy chủ
                xác nhận kích thước và MIME trước khi sử dụng. Chọn media khi tạo Content; thứ tự
                chọn là thứ tự hiển thị.
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
                Tạo API key riêng cho từng agent ở API keys, chọn quyền tối thiểu và đặt ngày hết
                hạn. Key chỉ hiện một lần; sao chép ngay và giữ ở nơi an toàn.
              </p>
              <code>X-API-Key: cmmi_live_…</code>
              <p>
                Creator chỉ truy cập tài nguyên của mình. Admin quản lý toàn bộ workspace, tài khoản
                và chính sách dọn media.
              </p>
            </article>
            <article className="panel">
              <span className="docs-icon">
                <Leaf size={24} />
              </span>
              <h3>03 · Keep your library light</h3>
              <p>
                Mặc định giữ file 7 ngày sau khi đăng. Cron chạy 02:00 UTC, tương đương 09:00 Việt
                Nam. Admin có thể bật/tắt, đổi lịch, số ngày giữ hoặc chạy ngay trong Settings.
              </p>
              <p>
                Media dùng chung với bản nháp, bài lên lịch, bài lưu trữ hoặc bài mới đăng sẽ được
                giữ. Khi xóa vật lý thành công, metadata vẫn còn với trạng thái Cleaned và URL được
                xóa.
              </p>
            </article>
            <article className="panel">
              <span className="docs-icon">
                <Bot size={24} />
              </span>
              <h3>04 · Made for agents, too</h3>
              <p>
                Agent lấy bài qua <code>GET /api/v1/contents?status=SCHEDULED</code>, thực hiện đăng
                ở hệ thống bên ngoài, sau đó cập nhật trạng thái và fb_post_id, tiktok_post_id,
                youtube_post_id qua PUT/PATCH.
              </p>
              <p>
                CMMI lưu dữ liệu và điều phối truy cập; việc đăng lên mạng xã hội do automation của
                bạn thực hiện.
              </p>
            </article>
          </div>
        </div>
      )}

      {/* ===================== TAB 3: API & SPECS ===================== */}
      {tab === 'api' && (
        <div className="docs-api-specs">
          <div className="docs__hero">
            <FileCode size={30} strokeWidth={1.3} />
            <span className="eyebrow">DEVELOPER & AI REFERENCES</span>
            <h2>
              Hợp đồng & Tài liệu Kỹ thuật.
              <br />Single Source of Truth.
            </h2>
            <p>
              Tất cả endpoints, schemas và error codes đều được đồng bộ chặt chẽ với OpenAPI 3.1
              Contract.
            </p>
          </div>
          <div className="docs-grid">
            <article className="panel">
              <h3>Interactive API Documentation</h3>
              <p>
                Xem và thử nghiệm trực tiếp toàn bộ REST API của CMMI trên giao diện Scalar UI hiện
                đại.
              </p>
              <div style={{ marginTop: '16px' }}>
                <a
                  className="button button--primary"
                  href={docsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở Scalar API Reference <ArrowUpRight size={16} />
                </a>
              </div>
            </article>

            <article className="panel">
              <h3>LLM Plaintext Contexts</h3>
              <p>
                Tài liệu tối giản dạng Markdown thô để nạp vào Context Window của bất kỳ mô hình AI
                nào mà không hao tốn token.
              </p>
              <div style={{ marginTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <a
                  className="button button--secondary"
                  href={llmsUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  /llms.txt (Ngắn gọn) <ArrowUpRight size={14} />
                </a>
                <a
                  className="button button--secondary"
                  href={llmsFullUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  /llms-full.txt (Đầy đủ) <ArrowUpRight size={14} />
                </a>
              </div>
            </article>

            <article className="panel">
              <h3>OpenAPI 3.1 Contract JSON</h3>
              <p>
                Tệp schema chuẩn quốc tế để nạp vào Custom GPT Actions, Postman, Insomnia, Swagger
                hoặc sinh client SDK tự động.
              </p>
              <div style={{ marginTop: '16px' }}>
                <a
                  className="button button--secondary"
                  href={openApiUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tải /openapi.json <ArrowUpRight size={14} />
                </a>
              </div>
            </article>

            <article className="panel">
              <h3>Download Agent Kit ZIP</h3>
              <p>
                Tải gói mã nguồn MCP Server và toàn bộ hướng dẫn cài đặt nhanh dành cho kỹ sư phát
                triển bot.
              </p>
              <div style={{ marginTop: '16px' }}>
                <a className="button button--secondary" href={downloadUrl} download>
                  Tải cmmi-agent-kit.zip <Download size={14} />
                </a>
              </div>
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
