import { useCallback, useState } from 'react';
import {
  ArrowDownUp,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  FileText,
  Layers3,
  List,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { Badge, ChannelBadge, Empty, ErrorBox, Pager, VideoThumbnail } from '../../components/Shared';
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

export default function ContentManager({ api, onHelp }: { api: Api; onHelp: () => void }) {
  const [status, setStatus] = useState<Status | ''>('');
  const [channel, setChannel] = useState<'facebook' | 'tiktok' | 'youtube' | ''>('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [view, setView] = useState<'table' | 'calendar'>('table');
  const [editor, setEditor] = useState<Content | 'new' | null>(null);
  const [error, setError] = useState('');
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
  return (
    <>
      <div className="stats-grid">
        {[
          {
            label: 'Content in this view',
            value: data.length,
            icon: Layers3,
            tone: 'sand',
            note: 'Your ideas, organized',
          },
          {
            label: 'Drafts',
            value: data.filter((i) => i.status === 'DRAFT').length,
            icon: FileText,
            tone: 'lilac',
            note: 'A little work in progress',
          },
          {
            label: 'Scheduled',
            value: data.filter((i) => i.status === 'SCHEDULED').length,
            icon: CalendarDays,
            tone: 'peach',
            note: 'Ready for their moment',
          },
          {
            label: 'Published',
            value: data.filter((i) => i.status === 'PUBLISHED').length,
            icon: CheckCheck,
            tone: 'mint',
            note: 'Out there making an impact',
          },
        ].map((item) => (
          <article className={`stat stat--${item.tone}`} key={item.label}>
            <div>
              <span>{item.label}</span>
              <item.icon size={18} strokeWidth={1.6} />
            </div>
            <strong>{items.loading ? '—' : String(item.value).padStart(2, '0')}</strong>
            <small>{item.note}</small>
          </article>
        ))}
      </div>
      <section className="panel content-panel">
        <div className="panel__heading">
          <div>
            <h2>
              Your stories <span className="count">{data.length}</span>
            </h2>
            <p>A home for every idea, draft and finished piece.</p>
          </div>
          <button className="button button--primary" onClick={() => setEditor('new')}>
            <Plus size={17} />
            New content
          </button>
        </div>
        <div className="toolbar">
          <div className="tabs">
            <button
              className={!status ? 'tab tab--active' : 'tab'}
              onClick={() => {
                setStatus('');
                setOffset(0);
              }}
            >
              All content
            </button>
            {(['DRAFT', 'SCHEDULED', 'PUBLISHED'] as Status[]).map((value) => (
              <button
                key={value}
                className={status === value ? 'tab tab--active' : 'tab'}
                onClick={() => {
                  setStatus(value);
                  setOffset(0);
                }}
              >
                {value[0] + value.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="view-toggle">
            <button
              aria-label="Table view"
              className={view === 'table' ? 'active' : ''}
              onClick={() => setView('table')}
            >
              <List size={17} />
            </button>
            <button
              aria-label="Calendar view"
              className={view === 'calendar' ? 'active' : ''}
              onClick={() => setView('calendar')}
            >
              <CalendarDays size={17} />
            </button>
          </div>
        </div>
        <div className="filterbar">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Search content"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setOffset(0);
              }}
              placeholder="Find a story…"
            />
          </label>
          <div>
            <select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as Status | '');
                setOffset(0);
              }}
            >
              <option value="">All statuses</option>
              {['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Filter by channel"
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
          </div>
        </div>
        <ErrorBox message={error || items.error} />
        {items.loading ? (
          <div className="loading">Gathering your stories…</div>
        ) : view === 'calendar' ? (
          <Calendar items={data} onSelect={setEditor} />
        ) : data.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th className="table-check">
                    <span className="table-marker" />
                  </th>
                  <th>
                    CONTENT <ArrowDownUp size={12} />
                  </th>
                  <th>STATUS</th>
                  <th>CHANNELS</th>
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
                            if (!primary) return <FileText size={19} />;
                            if (primary.media_type === 'IMAGE') {
                              return <img src={primary.public_url} alt="" loading="lazy" />;
                            }
                            return <VideoThumbnail src={primary.public_url} alt={item.title} />;
                          })()}
                        </span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.body.slice(0, 55) || 'A new story waiting to unfold'}</small>
                        </span>
                      </button>
                    </td>
                    <td>
                      <Badge status={item.status} />
                    </td>
                    <td>
                      <div className="channels">
                        <ChannelBadge channel="facebook" value={item.fb_post_id} />
                        <ChannelBadge channel="tiktok" value={item.tiktok_post_id} />
                        <ChannelBadge channel="youtube" value={item.youtube_post_id} />
                      </div>
                    </td>
                    <td className="date-cell">{dateText(item.scheduled_at)}</td>
                    <td>
                      <span className="media-count">{item.media_assets.length} assets</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button aria-label={`Edit ${item.title}`} onClick={() => setEditor(item)}>
                          <Pencil size={15} />
                        </button>
                        <button
                          aria-label={`Delete ${item.title}`}
                          onClick={() => void remove(item)}
                        >
                          <Trash2 size={15} />
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
      <div className="bottom-note">
        <div>
          <span className="note-icon">
            <ArrowUpRight size={19} />
          </span>
          <span>
            <strong>Your next great idea deserves a little space.</strong>
            <small>
              Keep drafts, assets and publishing details together. The rest is up to you.
            </small>
          </span>
        </div>
        <a
          href="/help"
          onClick={(event) => {
            event.preventDefault();
            onHelp();
          }}
        >
          Meet your workspace <ArrowUpRight size={15} />
        </a>
      </div>
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
