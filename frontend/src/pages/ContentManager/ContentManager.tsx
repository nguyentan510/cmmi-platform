import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDownUp,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  Badge,
  Empty,
  ErrorBox,
  FacebookIcon,
  Pager,
  TikTokIcon,
  VideoThumbnail,
  YouTubeIcon,
  getChannelUrl,
} from '../../components/Shared';
import {
  type Api,
  type Content,
  type Status,
  dateText,
  errorMessage,
  result,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';
import Calendar from './Calendar';
import ContentEditor from './ContentEditor';

interface ChannelLinkItem {
  key: 'facebook' | 'tiktok' | 'youtube';
  label: string;
  icon: typeof FacebookIcon;
  id?: string | null;
  url: string;
}

function ChannelDropdown({
  item,
  onEdit,
}: {
  item: Content;
  onEdit: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const channels: ChannelLinkItem[] = [
    {
      key: 'facebook',
      label: 'Facebook',
      icon: FacebookIcon,
      id: item.fb_post_id,
      url: getChannelUrl('facebook', item.fb_post_id),
    },
    {
      key: 'tiktok',
      label: 'TikTok',
      icon: TikTokIcon,
      id: item.tiktok_post_id,
      url: getChannelUrl('tiktok', item.tiktok_post_id),
    },
    {
      key: 'youtube',
      label: 'YouTube',
      icon: YouTubeIcon,
      id: item.youtube_post_id,
      url: getChannelUrl('youtube', item.youtube_post_id),
    },
  ];

  const connected = channels.filter((c) => !!c.id && !!c.id.trim());

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="channel-dropdown-wrapper" ref={dropdownRef}>
      <button
        type="button"
        className={`channel-toggle-pill ${connected.length > 0 ? 'channel-toggle-pill--active' : 'channel-toggle-pill--empty'}`}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        aria-expanded={isOpen}
        title="Bấm để xem danh sách link đã đăng"
      >
        {connected.length > 0 ? (
          <>
            <span className="channel-toggle-icons">
              {connected.map((c) => (
                <c.icon key={c.key} size={11} className={`channel-mini-icon--${c.key}`} />
              ))}
            </span>
            <span className="channel-toggle-count">{connected.length}/3 kênh</span>
          </>
        ) : (
          <span className="channel-toggle-empty-label">Chưa có link</span>
        )}
        <ChevronDown size={11} className={`channel-toggle-caret ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div
          className="channel-dropdown-menu"
          role="region"
          aria-label="Danh sách liên kết bài đăng"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="channel-dropdown-menu__header">
            <strong>Liên kết xuất bản</strong>
            <span className="count-tag">{connected.length}/3 đã kết nối</span>
          </div>

          <div className="channel-dropdown-menu__list">
            {channels.map((c) => {
              const hasUrl = !!c.url;
              return (
                <div
                  key={c.key}
                  className={`channel-item-row ${hasUrl ? 'channel-item-row--active' : 'channel-item-row--empty'}`}
                >
                  <div className="channel-item-row__meta">
                    <span className={`channel-badge-icon channel-badge-icon--${c.key}`}>
                      <c.icon size={13} />
                    </span>
                    <span className="channel-item-row__title">{c.label}</span>
                    {hasUrl ? (
                      <span className="status-tag status-tag--connected">Đã đăng</span>
                    ) : (
                      <span className="status-tag status-tag--empty">Trống</span>
                    )}
                  </div>

                  {hasUrl ? (
                    <div className="channel-item-row__link-box">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="channel-url-link"
                        title={c.url}
                      >
                        <span className="url-truncate">{c.url}</span>
                        <ExternalLink size={12} />
                      </a>
                      <button
                        type="button"
                        className="icon-action-btn"
                        title="Sao chép liên kết"
                        onClick={() => {
                          navigator.clipboard.writeText(c.url);
                          setCopiedKey(c.key);
                          setTimeout(() => setCopiedKey(null), 1500);
                        }}
                      >
                        {copiedKey === c.key ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  ) : (
                    <div className="channel-empty-frame">
                      <span className="channel-empty-frame__text">
                        Khung trống · Chưa đăng {c.label}
                      </span>
                      <button
                        type="button"
                        className="channel-add-id-btn"
                        onClick={() => {
                          setIsOpen(false);
                          onEdit();
                        }}
                      >
                        <Plus size={11} />
                        Thêm ID
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="channel-dropdown-menu__footer">
            <button
              type="button"
              className="quick-edit-btn"
              onClick={() => {
                setIsOpen(false);
                onEdit();
              }}
            >
              <Pencil size={12} />
              Mở sửa bài viết
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContentManager({ api, onHelp }: { api: Api; onHelp: () => void }) {
  const [status, setStatus] = useState<Status | ''>('');
  const [channel, setChannel] = useState<'facebook' | 'tiktok' | 'youtube' | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [editor, setEditor] = useState<Content | 'new' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchInput === search) return;
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setOffset(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, search]);

  const items = useLoad(
    () =>
      result(
        api.GET('/api/v1/contents', {
          params: {
            query: {
              status: status || undefined,
              channel: channel || undefined,
              search,
              offset,
              limit: 50,
            },
          },
        }),
      ),
    [api, status, channel, search, offset],
  );

  const close = useCallback(() => setEditor(null), []);

  async function remove(item: Content) {
    if (!window.confirm(`Delete “${item.title}”? Media files will remain in your library.`)) return;
    setError('');
    try {
      await result(
        api.DELETE('/api/v1/contents/{content_id}', { params: { path: { content_id: item.id } } }),
      );
      items.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const data = items.data ?? [];
  const draftCount = data.filter((i) => i.status === 'DRAFT').length;
  const scheduledCount = data.filter((i) => i.status === 'SCHEDULED').length;
  const publishedCount = data.filter((i) => i.status === 'PUBLISHED').length;

  return (
    <>
      <section className="panel content-panel">
        {/* All-in-One Compact Toolbar: Tabs with Counts + Filters + Primary Action */}
        <div className="unified-toolbar">
          <div className="tabs">
            <button
              className={!status ? 'tab tab--active' : 'tab'}
              onClick={() => {
                setStatus('');
                setOffset(0);
              }}
            >
              All content <span className="tab-badge">{data.length}</span>
            </button>
            <button
              className={status === 'DRAFT' ? 'tab tab--active' : 'tab'}
              onClick={() => {
                setStatus('DRAFT');
                setOffset(0);
              }}
            >
              Draft <span className="tab-badge">{draftCount}</span>
            </button>
            <button
              className={status === 'SCHEDULED' ? 'tab tab--active' : 'tab'}
              onClick={() => {
                setStatus('SCHEDULED');
                setOffset(0);
              }}
            >
              Scheduled <span className="tab-badge">{scheduledCount}</span>
            </button>
            <button
              className={status === 'PUBLISHED' ? 'tab tab--active' : 'tab'}
              onClick={() => {
                setStatus('PUBLISHED');
                setOffset(0);
              }}
            >
              Published <span className="tab-badge">{publishedCount}</span>
            </button>
          </div>

          <div className="toolbar-controls">
            <div className="search-field compact-search">
              <Search size={14} className="search-icon" />
              <input
                aria-label="Search content"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Find a story…"
              />
              {searchInput && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchInput('')}
                  aria-label="Xóa tìm kiếm"
                  title="Xóa tìm kiếm"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <select
              aria-label="Filter by channel"
              className={`compact-select ${channel ? 'compact-select--filtered' : ''}`}
              value={channel}
              onChange={(e) => {
                setChannel(e.target.value as typeof channel);
                setOffset(0);
              }}
            >
              <option value="">All channels</option>
              <option value="facebook">Facebook</option>
              <option value="tiktok">TikTok</option>
              <option value="youtube">YouTube</option>
            </select>

            <div className="view-toggle">
              <button
                aria-label="Table view"
                className={view === 'table' ? 'active' : ''}
                onClick={() => setView('table')}
                title="Bảng dữ liệu"
              >
                <List size={16} />
              </button>
              <button
                aria-label="Calendar view"
                className={view === 'calendar' ? 'active' : ''}
                onClick={() => setView('calendar')}
                title="Lịch xuất bản"
              >
                <CalendarDays size={16} />
              </button>
            </div>

            <button
              className="button button--primary button--sm"
              onClick={() => setEditor('new')}
              title="Tạo bài viết mới"
            >
              <Plus size={16} />
              New content
            </button>
          </div>
        </div>

        <ErrorBox message={error || items.error} />

        {items.loading ? (
          <div className="loading">Gathering your stories…</div>
        ) : view === 'calendar' ? (
          <Calendar items={data} onSelect={setEditor} />
        ) : data.length ? (
          <div className="table-scroll">
            <table className="compact-table">
              <thead>
                <tr>
                  <th className="table-check">
                    <span className="table-marker" />
                  </th>
                  <th>
                    CONTENT <ArrowDownUp size={12} />
                  </th>
                  <th>STATUS</th>
                  <th>CHANNELS & LINKS</th>
                  <th>SCHEDULED FOR</th>
                  <th>MEDIA</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="table-marker" />
                    </td>
                    <td>
                      <button className="content-title" onClick={() => setEditor(item)}>
                        <span
                          className={`content-thumb content-thumb--${item.status.toLowerCase()}`}
                        >
                          {(() => {
                            const primary = item.media_assets.find(
                              (m) => m.upload_confirmed && !m.is_cleaned && m.public_url,
                            );
                            if (!primary) return <FileText size={18} />;
                            if (primary.media_type === 'IMAGE') {
                              return <img src={primary.public_url} alt="" loading="lazy" />;
                            }
                            return <VideoThumbnail src={primary.public_url} alt={item.title} />;
                          })()}
                        </span>
                        <span className="content-text-group">
                          <strong>{item.title}</strong>
                          <small>{item.body.slice(0, 60) || 'Chưa có nội dung mô tả…'}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td className="channels-cell">
                      <ChannelDropdown item={item} onEdit={() => setEditor(item)} />
                    </td>
                    <td className="date-cell">{dateText(item.scheduled_at)}</td>
                    <td>
                      <span className="media-count">{item.media_assets.length} assets</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          aria-label={`Edit ${item.title}`}
                          title="Chỉnh sửa bài viết"
                          onClick={() => setEditor(item)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          aria-label={`Delete ${item.title}`}
                          title="Xóa bài viết"
                          onClick={() => void remove(item)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Your next story starts here">
            Add your first piece of content. Draft today, publish when you're ready.
          </Empty>
        )}
        <Pager offset={offset} length={data.length} onChange={setOffset} />
      </section>

      {editor && (
        <ContentEditor
          api={api}
          content={editor === 'new' ? undefined : editor}
          onClose={close}
          onSaved={() => {
            close();
            items.reload();
          }}
        />
      )}
    </>
  );
}
