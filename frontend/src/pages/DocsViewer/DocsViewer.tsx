import { useState, useEffect } from 'react';
import {
  AlertTriangle,
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
  Lock,
  Sparkles,
  Terminal,
  Wand2,
  X,
} from 'lucide-react';
import type { Api } from '../../services/api';

type Tab = 'hub' | 'workflows' | 'api';

interface DocsViewerProps {
  api?: Api;
  onNavigateToApiKeys?: () => void;
}

export default function DocsViewer({ api: _api, onNavigateToApiKeys }: DocsViewerProps) {
  const [tab, setTab] = useState<Tab>('hub');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rawApiBase = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';
  const docsUrl = apiBase ? `${apiBase}/docs` : '/docs';
  const openApiUrl = `${apiBase}/openapi.json`;
  const llmsUrl = `${apiBase}/llms.txt`;
  const llmsFullUrl = `${apiBase}/llms-full.txt`;
  const [detectedServerUrl, setDetectedServerUrl] = useState(apiBase || '');
  const [customApiKey, setCustomApiKey] = useState(() => {
    try {
      return sessionStorage.getItem('cmmi_last_api_key') || '';
    } catch {
      return '';
    }
  });

  const handleApiKeyChange = (val: string) => {
    setCustomApiKey(val);
    try {
      if (val.trim()) {
        sessionStorage.setItem('cmmi_last_api_key', val.trim());
      } else {
        sessionStorage.removeItem('cmmi_last_api_key');
      }
    } catch {
      // ignore storage access errors
    }
  };

  const handleNavigateToApiKeys = () => {
    if (onNavigateToApiKeys) {
      onNavigateToApiKeys();
    } else {
      window.dispatchEvent(new CustomEvent('cmmi:navigate-keys'));
    }
  };

  useEffect(() => {
    fetch(`${apiBase}/api/v1/tools/config`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.base_url) {
          setDetectedServerUrl(data.base_url);
        }
      })
      .catch(() => {});
  }, [apiBase]);

  // CMMI Base URL is strictly fixed to the active API server (no manual intervention allowed)
  const effectiveBaseUrl = detectedServerUrl || apiBase || (typeof window !== 'undefined' ? window.location.origin : '');
  const hasApiKey = Boolean(customApiKey.trim());
  const activeKeyDisplay = customApiKey.trim() || '{CMMI-API-KEY}';

  const downloadParams = new URLSearchParams();
  if (effectiveBaseUrl) {
    downloadParams.set('base_url', effectiveBaseUrl);
  }
  if (hasApiKey) {
    downloadParams.set('api_key', customApiKey.trim());
  }
  const downloadQuery = downloadParams.toString();
  const downloadUrl = `${apiBase}/api/v1/tools/agent-kit.zip${downloadQuery ? `?${downloadQuery}` : ''}`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === id ? null : curr));
    }, 2000);
  };

  const buildPromptText = `Bạn là AI Agent của tôi. Hãy tự động phát hiện môi trường, kết nối và cài đặt toàn diện CMMI Platform cho dự án này theo 4 bước sau:

1. TỰ ĐỘNG PHÁT HIỆN MÔI TRƯỜNG & THIẾT LẬP FILE .ENV:
- Tự động kiểm tra file \`.env\` ở thư mục gốc của workspace (nếu chưa có hãy tạo mới).
- Đảm bảo 2 biến môi trường sau được cấu hình chính xác (nếu đã có thì cập nhật, nếu chưa thì thêm vào cuối file):
CMMI_BASE_URL=${effectiveBaseUrl}
CMMI_API_KEY=${activeKeyDisplay}

2. TỰ ĐỘNG NẠP AGENT SKILL & MCP (AUTO-DETECT):
- Tải nội dung Skill CMMI từ endpoint:
  ${effectiveBaseUrl}/api/v1/tools/skill
- Tự động nhận diện công cụ đang sử dụng để đặt Skill / Rule vào đúng vị trí:
  + Nếu là Antigravity: Lưu vào \`.agents/skills/cmmi-automation/SKILL.md\`
  + Nếu là Cursor: Tạo hoặc cập nhật \`.cursorrules\` và \`agent-kit/SKILL.md\`
  + Nếu là Windsurf: Tạo hoặc cập nhật \`.windsurfrules\` và \`agent-kit/SKILL.md\`
  + Nếu là Claude Code / Claude Desktop: Lưu Skill vào workspace hoặc cấu hình MCP Server
- Đọc và tuân thủ các safeguards: chuẩn hóa múi giờ UTC, bảo vệ Cloudflare R2 Media Retention 7 ngày, quy chuẩn 4 kênh (Facebook, TikTok, YouTube, Blog) và phân vai 5 Subagent trong Skill.

3. TỰ ĐỘNG CHẠY TEST KẾT NỐI (TEST END-TO-END):
- Test 1 (Kiểm tra Backend Server sống):
  curl -s "${effectiveBaseUrl}/health"
- Test 2 (Kiểm tra xác thực API Key):
  curl -s -H "X-API-Key: ${activeKeyDisplay}" "${effectiveBaseUrl}/api/v1/contents?limit=1"

4. BÁO CÁO KẾT QUẢ CHO TÔI:
- Trả về bảng kết quả kiểm tra định dạng Markdown:
  | Hạng mục | Trạng thái | Ghi chú |
  | Môi trường phát hiện | [Tên IDE / Agent] | Auto-detected |
  | Backend Server | ✅/❌ | URL: ${effectiveBaseUrl} |
  | CMMI API Key | ✅/❌ | Xác thực quyền truy cập |
  | CMMI Agent Skill | ✅/❌ | Đã nạp thành công vào workspace |
- Đưa ra 1 gợi ý lệnh tiếp theo để tôi có thể bắt đầu tạo hoặc lên lịch nội dung ngay.`;

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
                <Sparkles size={14} /> Gói Tự Động Gắn Sẵn Domain ({effectiveBaseUrl})
              </div>
              <h3>CMMI Agent Toolkit (.zip)</h3>
              <p>
                Trọn gói mã nguồn Python MCP Server, bộ hướng dẫn chi tiết, tự động điền sẵn Domain và API Key
                vào các file <code>.env</code>, <code>claude_desktop_config.json</code>, và <code>shared/openapi.json</code>.
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
              Hệ thống tự động đồng bộ Domain máy chủ API. Vui lòng nhập API Key để cấu hình hoàn chỉnh cho AI Agent:
            </p>
            <div className="agent-config-inputs">
              {/* Field 1: CMMI Base URL - Cố định theo Server API */}
              <div className="agent-input-field">
                <div className="agent-input-field__label-row">
                  <label htmlFor="cmmi-base-url-input">CMMI Base URL (Tự động bám theo Server):</label>
                  <span className="agent-status-badge agent-status-badge--locked" title="Khóa cố định theo API Server">
                    <Lock size={12} /> Cố định theo Server
                  </span>
                </div>
                <div className="agent-readonly-input-wrap">
                  <input
                    id="cmmi-base-url-input"
                    type="text"
                    value={effectiveBaseUrl}
                    readOnly
                    disabled
                    aria-readonly="true"
                    className="agent-input agent-input--locked"
                    title="URL máy chủ cố định theo API Server, không cho phép can thiệp chỉnh sửa"
                  />
                  <span className="agent-input-lock-icon" aria-hidden="true" title="Đã khóa theo máy chủ API">
                    <Lock size={14} />
                  </span>
                </div>
                <div className="agent-field-hint">
                  <span>🌐 URL máy chủ chính thức được tự động đồng bộ từ Backend API (Không thể can thiệp)</span>
                </div>
              </div>

              {/* Field 2: API Key - Hiển thị cảnh báo & Điều hướng khi chưa điền */}
              <div className="agent-input-field">
                <div className="agent-input-field__label-row">
                  <label htmlFor="cmmi-api-key-input">API Key của bạn:</label>
                  {!hasApiKey ? (
                    <span className="agent-status-badge agent-status-badge--warning">
                      <AlertTriangle size={12} /> Chưa điền API Key
                    </span>
                  ) : (
                    <span className="agent-status-badge agent-status-badge--success">
                      <Check size={12} /> Đã sẵn sàng
                    </span>
                  )}
                </div>
                <div className="agent-input-action-wrap">
                  <input
                    id="cmmi-api-key-input"
                    type="text"
                    value={customApiKey}
                    onChange={(e) => handleApiKeyChange(e.target.value)}
                    placeholder="cmmi_live_... (Dán API Key tại đây)"
                    className={`agent-input ${!hasApiKey ? 'agent-input--warning' : 'agent-input--valid'}`}
                  />
                  {hasApiKey && (
                    <button
                      type="button"
                      className="agent-input-clear-btn"
                      onClick={() => handleApiKeyChange('')}
                      title="Xóa API Key đã nhập"
                      aria-label="Xóa API Key"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {!hasApiKey ? (
                  <div className="agent-apikey-warning-box">
                    <div className="agent-apikey-warning-box__content">
                      <AlertTriangle size={16} className="agent-warning-icon" />
                      <span>Chưa có API Key? Bạn cần tạo API Key để cấp quyền xác thực cho AI Agent.</span>
                    </div>
                    <button
                      type="button"
                      className="button button--secondary button--small agent-nav-api-btn"
                      onClick={handleNavigateToApiKeys}
                    >
                      <KeyRound size={13} /> Đi tới khu vực tạo API Key <ArrowUpRight size={13} />
                    </button>
                  </div>
                ) : (
                  <div className="agent-field-hint agent-field-hint--success">
                    <Check size={13} /> Đã nạp API Key vào mẫu cấu hình và Build Prompt bên dưới.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Card Build Prompt — 1-Click Master Setup */}
          <div className="agent-build-prompt-card panel">
            <div className="agent-build-prompt-card__header">
              <div className="agent-build-prompt-card__title-group">
                <Wand2 size={20} color="#059669" />
                <h3>Card Build Prompt — Thiết Lập AI Agent Tự Động Từ A-Z</h3>
              </div>
              <span className="agent-build-prompt-card__badge">
                <Sparkles size={13} /> 1 Prompt Auto-Detect & Cài Đặt 100%
              </span>
            </div>
            <p className="agent-build-prompt-card__desc">
              Chỉ cần sao chép 1 Prompt duy nhất dưới đây và dán vào <strong>Cursor, Claude Code, Antigravity, hoặc Windsurf</strong>.
              AI Agent sẽ <strong>tự động nhận diện môi trường IDE</strong>, <strong>tự động nạp Skill & Rules</strong>, <strong>tự cấu hình file <code>.env</code></strong>, <strong>tự chạy lệnh test kết nối</strong> và <strong>in bảng báo cáo kết quả</strong> ngay trong khung chat!
            </p>
            <div className="agent-build-prompt-card__steps-preview">
              <span className="step-pill">
                <span className="step-num">1</span> Tự phát hiện môi trường & .env
              </span>
              <span className="step-pill">
                <span className="step-num">2</span> Tự nạp Skill & Rules (Auto-detect)
              </span>
              <span className="step-pill">
                <span className="step-num">3</span> Tự chạy test cURL /health & Auth
              </span>
              <span className="step-pill">
                <span className="step-num">4</span> Báo cáo bảng trạng thái chi tiết
              </span>
            </div>

            {!hasApiKey && (
              <div className="agent-prompt-warning-callout">
                <div className="agent-prompt-warning-callout__left">
                  <AlertTriangle size={18} className="callout-icon" />
                  <div>
                    <strong>Chưa có API Key trong Build Prompt:</strong>
                    <p>
                      Mã prompt bên dưới đang sử dụng placeholder tạm thời <code>{'{CMMI-API-KEY}'}</code>. Hãy tạo và dán API Key để AI Agent có thể vượt qua bước kiểm tra xác thực.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="button button--secondary agent-prompt-warning-callout__btn"
                  onClick={handleNavigateToApiKeys}
                >
                  <KeyRound size={14} /> Đi tới khu vực tạo API Key <ArrowUpRight size={13} />
                </button>
              </div>
            )}

            <div className="agent-build-prompt-card__code-container">
              <pre>
                <code>{buildPromptText}</code>
              </pre>
            </div>
            <div className="agent-build-prompt-card__footer">
              <div className="target-hint">
                <span>Server đích:</span>
                <strong>{effectiveBaseUrl}</strong>
                {!hasApiKey && (
                  <span className="target-hint__key-badge target-hint__key-badge--warning">
                    <AlertTriangle size={12} /> Thiếu API Key
                  </span>
                )}
              </div>
              <div className="agent-build-prompt-card__footer-actions">
                {!hasApiKey && (
                  <button
                    type="button"
                    className="button button--secondary agent-footer-nav-btn"
                    onClick={handleNavigateToApiKeys}
                  >
                    <KeyRound size={15} /> Tạo API Key
                  </button>
                )}
                <button
                  className="button button--primary button--large"
                  style={{ background: '#059669', borderColor: '#059669', color: '#fff' }}
                  onClick={() => copyToClipboard(buildPromptText, 'build-prompt')}
                >
                  {copiedKey === 'build-prompt' ? (
                    <>
                      <Check size={16} /> Đã sao chép Build Prompt
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Sao chép Build Prompt (1-Click)
                    </>
                  )}
                </button>
              </div>
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
