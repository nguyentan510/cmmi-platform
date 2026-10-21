import { useState, useEffect } from 'react';
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
  Wand2,
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
  const openApiUrl = `${apiBase}/openapi.json`;
  const llmsUrl = `${apiBase}/llms.txt`;
  const llmsFullUrl = `${apiBase}/llms-full.txt`;
  const [customServerUrl, setCustomServerUrl] = useState('');
  const [detectedServerUrl, setDetectedServerUrl] = useState(apiBase || '');
  const [customApiKey, setCustomApiKey] = useState('');

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

  // Dynamic Base URL: tracks live server, user custom domain, or flexible {BASE-URL} template
  const effectiveBaseUrl = customServerUrl.trim() || detectedServerUrl || '{BASE-URL}';
  const activeKeyDisplay = customApiKey.trim() || '{CMMI-API-KEY}';

  const downloadParams = new URLSearchParams();
  if (customServerUrl.trim() && customServerUrl.trim() !== '{BASE-URL}') {
    downloadParams.set('base_url', customServerUrl.trim());
  }
  if (customApiKey.trim() && customApiKey.trim() !== '{CMMI-API-KEY}') {
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

  const claudeConfigJson = JSON.stringify(
    {
      mcpServers: {
        cmmi: {
          command: 'python',
          args: ['<duong-dan-toi-agent-kit>/server.py'],
          env: {
            CMMI_BASE_URL: effectiveBaseUrl,
            CMMI_API_KEY: customApiKey.trim() || '{CMMI-API-KEY}',
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

  const cursorRulesText = `## CMMI Platform — Agent Skill (Zero-Setup)
Tất cả cấu hình được móc tự động từ file .env (CMMI_BASE_URL=${effectiveBaseUrl} và CMMI_API_KEY=${activeKeyDisplay}).
Khi người dùng yêu cầu liên quan đến quản lý nội dung:
1. Nạp ảnh vào Cloudflare R2: Gọi POST ${effectiveBaseUrl}/api/v1/media/upload-from-url bằng curl.
2. Kiểm tra lịch đăng: Gọi GET ${effectiveBaseUrl}/api/v1/contents?status=SCHEDULED bằng curl.
3. Tạo bài & lên lịch: Gọi POST ${effectiveBaseUrl}/api/v1/contents (chuẩn hóa giờ UTC).
4. Đồng bộ đã đăng MXH: Gọi PATCH ${effectiveBaseUrl}/api/v1/contents/{id} đổi status sang PUBLISHED.`;

  const universalSkillText = `---
name: cmmi-agent-kit
description: Điều phối và tự động hóa toàn diện CMMI Platform (Content & Media Management Infrastructure). Tích hợp kiến thức đa kênh, chuẩn hóa múi giờ UTC, bảo vệ Cloudflare R2 Media Retention và kiến trúc phân vai Subagent qua cURL RESTful API.
---

# CMMI Platform — Universal Agent & Subagent Orchestration Skill (cURL First)
Base URL: ${effectiveBaseUrl}
X-API-Key: ${activeKeyDisplay}

## 🧠 HỆ THỐNG KIẾN THỨC NỀN TẢNG (SAFEGUARDS):
1. **Chuẩn Múi Giờ UTC**: Toàn bộ scheduled_at phải dùng định dạng UTC ISO-8601 (Giờ UTC = Giờ địa phương - 7 tiếng đối với GMT+7). Tuyệt đối không gửi giờ địa phương chưa quy đổi.
2. **Media Retention 7 ngày**: Media liên kết với bài DRAFT, SCHEDULED, ARCHIVED hoặc vừa PUBLISHED < 7 ngày được bảo vệ tuyệt đối trên Cloudflare R2.
3. **Quy chuẩn kênh**:
   - FACEBOOK: Ảnh 1:1 hoặc 4:5; Caption 150-350 từ; 3-5 hashtags.
   - TIKTOK: Video dọc 9:16 (1080x1920); Caption < 150 ký tự; 4-6 hashtags.
   - YOUTUBE: Video 16:9 hoặc Shorts 9:16; Title < 70 ký tự; Mô tả có Timestamps.
   - BLOG: Banner 16:9; 800-2500 từ chuẩn Markdown H1, H2, H3.

## 👥 MA TRẬN PHÂN VAI SUBAGENT:
- 👑 Content Lead: Tiếp nhận mục tiêu, chia việc và báo cáo tổng kết.
- 🎨 Media Specialist: Nạp ảnh/video vào R2 bằng upload-from-url hoặc upload 3 bước để lấy media_ids.
- ✍️ Copywriter Specialist: Soạn thảo tiêu đề, nội dung Markdown chuẩn kênh.
- ⏱️ Schedule Auditor: Kiểm tra lịch GET /contents?status=SCHEDULED, rà soát trùng lịch và bài OVERDUE.
- 🔄 Social Sync Operator: Cập nhật fb_post_id, tiktok_post_id sau khi xuất bản.

## 🧭 HƯỚNG DẪN THỰC THI CHO AGENT:
- Có quyền Terminal / Shell: Tự động chạy ngầm các lệnh curl bên dưới (sử dụng biến $CMMI_BASE_URL từ .env hoặc URL trực tiếp).
- Chat Web (Claude.ai Web, ChatGPT): Soạn sẵn khối lệnh curl hoàn chỉnh (đã điền đủ URL, API Key, payload JSON) để người dùng 1-Click Copy chạy trên máy tính.

## 🛠️ CÁC LỆNH cURL CHUẨN:
# 1. Kiểm tra lịch đăng bài (Schedule Audit):
curl -s -X GET "${effectiveBaseUrl}/api/v1/contents?status=SCHEDULED&limit=50" \\
  -H "X-API-Key: ${activeKeyDisplay}"

# 2. Nạp ảnh từ mạng vào Cloudflare R2 (1 Bước):
curl -s -X POST "${effectiveBaseUrl}/api/v1/media/upload-from-url" \\
  -H "X-API-Key: ${activeKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com/photo.jpg", "file_name": "banner.jpg"}'

# 3. Tạo bài viết & Lên lịch đăng (UTC ISO-8601):
curl -s -X POST "${effectiveBaseUrl}/api/v1/contents" \\
  -H "X-API-Key: ${activeKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Tiêu đề", "body": "Nội dung Markdown", "status": "SCHEDULED", "scheduled_at": "2026-10-25T02:00:00Z", "channel": "FACEBOOK", "media_ids": []}'

# 4. Xác nhận bài đã đăng mạng xã hội:
curl -s -X PATCH "${effectiveBaseUrl}/api/v1/contents/<CONTENT_ID>" \\
  -H "X-API-Key: ${activeKeyDisplay}" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "PUBLISHED", "fb_post_id": "123456789"}'`;

  const buildPromptText = `Bạn là AI Agent của tôi. Hãy tự động kết nối và thiết lập toàn diện hệ thống CMMI Platform cho dự án này theo 4 bước sau:

1. TỰ ĐỘNG THIẾT LẬP FILE .ENV:
- Kiểm tra file \`.env\` ở thư mục gốc của workspace (nếu chưa có hãy tạo mới).
- Đảm bảo 2 biến môi trường sau được cấu hình chính xác (nếu đã có thì cập nhật, nếu chưa thì thêm vào cuối file):
CMMI_BASE_URL=${effectiveBaseUrl}
CMMI_API_KEY=${activeKeyDisplay}

2. TỰ ĐỘNG NẠP AGENT SKILL:
- Tải nội dung Skill CMMI từ endpoint:
  ${effectiveBaseUrl}/api/v1/tools/skill
  và lưu vào file \`agent-kit/SKILL.md\` (hoặc \`.agents/skills/cmmi-automation/SKILL.md\`).
- Đọc và tuân thủ các quy trình điều phối đa kênh, múi giờ UTC và phân vai 5 Subagent trong Skill.

3. TỰ ĐỘNG KIỂM TRA KẾT NỐI (TEST END-TO-END):
- Test 1 (Kiểm tra Server sống):
  curl -s "${effectiveBaseUrl}/health"
- Test 2 (Kiểm tra xác thực API Key):
  curl -s -H "X-API-Key: ${activeKeyDisplay}" "${effectiveBaseUrl}/api/v1/contents?limit=1"

4. BÁO CÁO KẾT QUẢ CHO TÔI:
- Trả về bảng kết quả kiểm tra định dạng Markdown:
  | Hạng mục | Trạng thái | Ghi chú |
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
              Nhập API Key và Domain của bạn để mã cấu hình bên dưới tự động cập nhật ngay lập tức:
            </p>
            <div className="agent-config-inputs">
              <div className="agent-input-field">
                <label>CMMI Base URL ({customServerUrl ? 'Đang chọn' : 'Tự động bám theo Server'}):</label>
                <input
                  type="text"
                  value={customServerUrl}
                  onChange={(e) => setCustomServerUrl(e.target.value)}
                  placeholder={`{BASE-URL} (vd: ${detectedServerUrl || apiBase || 'https://your-domain.com'})`}
                />
                <div className="agent-url-presets">
                  <button
                    type="button"
                    className={`agent-url-preset-btn ${!customServerUrl ? 'agent-url-preset-btn--active' : ''}`}
                    onClick={() => setCustomServerUrl('')}
                    title="Tự động theo dõi domain của backend server hiện tại"
                  >
                    🌐 Theo Server ({detectedServerUrl || apiBase || 'Live'})
                  </button>
                  <button
                    type="button"
                    className={`agent-url-preset-btn ${customServerUrl === '{BASE-URL}' ? 'agent-url-preset-btn--active' : ''}`}
                    onClick={() => setCustomServerUrl('{BASE-URL}')}
                    title="Sử dụng biến động {BASE-URL} làm khuôn mẫu"
                  >
                    ⚡ Mẫu {'{BASE-URL}'}
                  </button>
                  <button
                    type="button"
                    className={`agent-url-preset-btn ${customServerUrl === 'auto' ? 'agent-url-preset-btn--active' : ''}`}
                    onClick={() => setCustomServerUrl('auto')}
                    title="Chế độ auto dò tìm localhost hoặc cloud"
                  >
                    🔄 auto
                  </button>
                </div>
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

          {/* Card Build Prompt — 1-Click Master Setup */}
          <div className="agent-build-prompt-card panel">
            <div className="agent-build-prompt-card__header">
              <div className="agent-build-prompt-card__title-group">
                <Wand2 size={20} color="#059669" />
                <h3>Card Build Prompt — Thiết Lập AI Agent Tự Động Từ A-Z</h3>
              </div>
              <span className="agent-build-prompt-card__badge">
                <Sparkles size={13} /> 1 Prompt Tự Động Hóa 100%
              </span>
            </div>
            <p className="agent-build-prompt-card__desc">
              Chỉ cần sao chép 1 Prompt duy nhất dưới đây và dán vào <strong>Cursor, Claude Code, Antigravity, hoặc Windsurf</strong>.
              AI Agent sẽ <strong>tự thêm Skill vào hệ thống</strong>, <strong>tự điền Key vào file <code>.env</code></strong>, <strong>tự chạy lệnh test kết nối</strong> và <strong>in bảng báo cáo kết quả</strong> ngay trong khung chat!
            </p>
            <div className="agent-build-prompt-card__steps-preview">
              <span className="step-pill">
                <span className="step-num">1</span> Tự cấu hình .env (URL & API Key)
              </span>
              <span className="step-pill">
                <span className="step-num">2</span> Tự nạp CMMI Agent Skill
              </span>
              <span className="step-pill">
                <span className="step-num">3</span> Tự chạy test cURL /health & Auth
              </span>
              <span className="step-pill">
                <span className="step-num">4</span> Báo cáo bảng trạng thái chi tiết
              </span>
            </div>
            <div className="agent-build-prompt-card__code-container">
              <pre>
                <code>{buildPromptText}</code>
              </pre>
            </div>
            <div className="agent-build-prompt-card__footer">
              <div className="target-hint">
                <span>Server đích:</span>
                <strong>{effectiveBaseUrl}</strong>
              </div>
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

          {/* Quickstart 3 Platforms */}
          <div className="agent-platforms-grid">
            {/* Platform 1: Claude Web & Desktop */}
            <div className="panel platform-card">
              <div className="platform-card__header">
                <div className="platform-badge platform-badge--claude">Claude (Web Skill & Desktop)</div>
                <div className="platform-card__actions">
                  <button
                    className="icon-copy-btn"
                    title="Sao chép toàn bộ Universal cURL Skill (Không cần cài đặt)"
                    onClick={() => copyToClipboard(universalSkillText, 'curl-skill')}
                  >
                    {copiedKey === 'curl-skill' ? (
                      <>
                        <Check size={14} /> Đã sao chép
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} /> Copy cURL Skill
                      </>
                    )}
                  </button>
                  <button
                    className="icon-copy-btn"
                    title="Sao chép cấu hình JSON cho Claude Desktop"
                    onClick={() => copyToClipboard(claudeConfigJson, 'claude')}
                  >
                    {copiedKey === 'claude' ? (
                      <>
                        <Check size={14} /> Đã chép
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> JSON
                      </>
                    )}
                  </button>
                </div>
              </div>
              <h4>1. Claude (Web Skill cURL & Desktop MCP)</h4>
              <p>
                <strong>Cách A — Universal cURL Skill (0 Cài Đặt - Khuyên Dùng):</strong><br />
                Bấm <strong>Copy cURL Skill</strong> ở trên và dán thẳng vào phiên chat (hoặc tải file <code>SKILL.md</code> lên). Claude sẽ tự động điều phối và soạn sẵn lệnh cURL chuẩn để bạn 1-Click Copy chạy trên máy tính.
              </p>
              <p style={{ marginTop: '0.6rem' }}>
                <strong>Cách B — Claude Desktop (Native MCP Tools 🔨):</strong>
              </p>
              <div className="code-block-wrapper">
                <pre>
                  <code>{claudeConfigJson}</code>
                </pre>
              </div>
              <ol className="platform-steps">
                <li>
                  Chạy <code>pip install -r requirements.txt</code> trong thư mục agent-kit.
                </li>
                <li>
                  Dán khối JSON trên vào <code>%APPDATA%\Claude\claude_desktop_config.json</code>.
                </li>
                <li>Khởi động lại Claude Desktop để nhận 7 tools của CMMI.</li>
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
