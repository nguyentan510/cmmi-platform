import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImagePlus,
  Layers3,
  Loader2,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Drawer,
  ErrorBox,
  FacebookIcon,
  TikTokIcon,
  VideoThumbnail,
  YouTubeIcon,
  getChannelUrl,
} from '../../components/Shared';
import {
  type Api,
  type Content,
  type ContentInput,
  type Media,
  type Status,
  type UploadProgress,
  errorMessage,
  formatBytes,
  localDateTime,
  result,
  uploadMedia,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';
import MediaPickerModal from './MediaPickerModal';

export default function ContentEditor({
  api,
  content,
  onClose,
  onSaved,
}: {
  api: Api;
  content?: Content;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(content?.title ?? '');
  const [body, setBody] = useState(content?.body ?? '');
  const [status, setStatus] = useState<Status>(content?.status ?? 'DRAFT');
  const [scheduled, setScheduled] = useState(localDateTime(content?.scheduled_at));
  const [facebook, setFacebook] = useState(content?.fb_post_id ?? '');
  const [tiktok, setTiktok] = useState(content?.tiktok_post_id ?? '');
  const [youtube, setYoutube] = useState(content?.youtube_post_id ?? '');
  const [selected, setSelected] = useState<string[]>(content?.media_assets.map((m) => m.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    loaded: number;
    total: number;
    percent: number;
    stage: 'preparing' | 'uploading' | 'verifying' | 'done';
  } | null>(null);
  const [error, setError] = useState('');
  const [mediaOffset] = useState(0);

  // Store known media details so we can render visual cards
  const [knownMedia, setKnownMedia] = useState<Map<string, Media>>(() => {
    const map = new Map<string, Media>();
    content?.media_assets?.forEach((m) => map.set(m.id, m));
    return map;
  });

  const library = useLoad(
    () =>
      result(
        api.GET('/api/v1/media', {
          params: { query: { is_cleaned: false, offset: mediaOffset, limit: 50 } },
        }),
      ),
    [api, mediaOffset],
  );

  useEffect(() => {
    if (library.data?.length) {
      setKnownMedia((prev) => {
        const updated = new Map(prev);
        library.data?.forEach((m) => updated.set(m.id, m));
        return updated;
      });
    }
  }, [library.data]);

  const close = useCallback(onClose, [onClose]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data: ContentInput = {
        title,
        body,
        status,
        scheduled_at: scheduled ? new Date(scheduled).toISOString() : null,
        fb_post_id: facebook,
        tiktok_post_id: tiktok,
        youtube_post_id: youtube,
        media_ids: selected,
      };
      if (content) {
        if (JSON.stringify(selected) === JSON.stringify(content.media_assets.map((m) => m.id)))
          delete data.media_ids;
        await result(
          api.PUT('/api/v1/contents/{content_id}', {
            params: { path: { content_id: content.id } },
            body: data,
          }),
        );
      } else await result(api.POST('/api/v1/contents', { body: data }));
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function upload(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    setUploadProgress({
      fileName: file.name,
      loaded: 0,
      total: file.size,
      percent: 0,
      stage: 'preparing',
    });
    try {
      const item = await uploadMedia(api, file, (p: UploadProgress) => {
        setUploadProgress({
          fileName: file.name,
          loaded: p.loaded,
          total: p.total,
          percent: p.percent,
          stage: p.stage ?? 'uploading',
        });
      });
      setKnownMedia((prev) => new Map(prev).set(item.id, item));
      setSelected((previous) => [...previous, item.id]);
      library.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  const moveItem = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= selected.length) return;
    setSelected((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  return (
    <>
      <Drawer title={content ? 'Edit your story' : 'Create a new story'} onClose={close}>
        <form onSubmit={save} className="editor editor--drawer">
          <ErrorBox message={error || library.error} />
          <label>
            Title
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={255}
              placeholder="Give your next story a name"
            />
          </label>
          <label>
            Body
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Start with an idea… Markdown is welcome."
            />
          </label>
          <div className="form-grid">
            <label>
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
                {['DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED'].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              Scheduled at · local time
              <input
                type="datetime-local"
                value={scheduled}
                onChange={(e) => setScheduled(e.target.value)}
                required={status === 'SCHEDULED'}
              />
            </label>
          </div>

          {/* Visual Media Attachments Section */}
          <fieldset className="editor-fieldset">
            <legend>
              <ImagePlus size={17} />
              Media attachments{' '}
              <small>{selected.length} selected · selection order is display order</small>
            </legend>

            {selected.length === 0 ? (
              <div
                className="media-tray-empty"
                onClick={() => setIsPickerOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    setIsPickerOpen(true);
                  }
                }}
              >
                <div className="media-tray-empty__icon">
                  <ImagePlus size={24} />
                </div>
                <div className="media-tray-empty__content">
                  <strong>Chưa có media nào được đính kèm</strong>
                  <p>Mở Thư viện Media để chọn trực quan hình ảnh hoặc video cho bài viết.</p>
                </div>
                <button
                  type="button"
                  className="button button--secondary button--sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPickerOpen(true);
                  }}
                >
                  <Layers3 size={15} />
                  Mở Thư viện chọn Media
                </button>
              </div>
            ) : (
              <div className="selected-media-section">
                <div
                  className="selected-media-tray"
                  role="list"
                  aria-label="Selected media attachments"
                >
                  {selected.map((id, index) => {
                    const item = knownMedia.get(id);
                    return (
                      <div key={id} className="selected-media-card" role="listitem">
                        <div className="selected-media-card__thumb">
                          {item ? (
                            item.media_type === 'VIDEO' ? (
                              <VideoThumbnail src={item.public_url} alt={item.file_name} />
                            ) : (
                              <img src={item.public_url} alt={item.file_name} loading="lazy" />
                            )
                          ) : (
                            <div className="media-placeholder">Media #{index + 1}</div>
                          )}
                        </div>

                        <div className="selected-media-card__order" title={`Thứ tự #${index + 1}`}>
                          #{index + 1}
                        </div>

                        <button
                          type="button"
                          className="selected-media-card__remove"
                          onClick={() => setSelected((prev) => prev.filter((itemId) => itemId !== id))}
                          aria-label={`Gỡ bỏ ${item?.file_name ?? 'tệp'}`}
                          title="Gỡ bỏ khỏi bài viết"
                        >
                          <X size={14} />
                        </button>

                        {selected.length > 1 && (
                          <div className="selected-media-card__reorder">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveItem(index, 'left')}
                              aria-label="Di chuyển lên trước"
                              title="Di chuyển lên trước"
                            >
                              <ChevronLeft size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={index === selected.length - 1}
                              onClick={() => moveItem(index, 'right')}
                              aria-label="Di chuyển ra sau"
                              title="Di chuyển ra sau"
                            >
                              <ChevronRight size={13} />
                            </button>
                          </div>
                        )}

                        <div className="selected-media-card__scrim">
                          <span className="selected-media-card__filename" title={item?.file_name}>
                            {item?.file_name ?? `ID: ${id.slice(0, 8)}...`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="selected-media-toolbar">
                  <button
                    type="button"
                    className="button button--secondary button--sm"
                    onClick={() => setIsPickerOpen(true)}
                  >
                    <ImagePlus size={14} />
                    Quản lý / Chọn thêm Media ({selected.length})
                  </button>
                  <label className="button button--ghost button--sm">
                    <Upload size={14} />
                    {uploading ? 'Đang tải lên…' : 'Tải tệp mới'}
                    <input
                      className="sr-only"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
                      disabled={uploading}
                      onChange={(e) => void upload(e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    className="button button--ghost button--sm text-muted"
                    onClick={() => setSelected([])}
                  >
                    <Trash2 size={13} />
                    Bỏ chọn tất cả
                  </button>
                </div>
              </div>
            )}

            {uploadProgress && (
              <div
                className="upload-progress-card upload-progress-card--compact"
                role="status"
                aria-live="polite"
              >
                <div className="upload-progress-card__header">
                  <div className="upload-progress-card__info">
                    <Loader2 size={14} className="spin" />
                    <span
                      className="upload-progress-card__filename"
                      title={uploadProgress.fileName}
                    >
                      {uploadProgress.fileName}
                    </span>
                  </div>
                  <span className="upload-progress-card__badge">
                    {uploadProgress.stage === 'preparing' && 'Khởi tạo...'}
                    {uploadProgress.stage === 'uploading' && `${uploadProgress.percent}%`}
                    {uploadProgress.stage === 'verifying' && 'Xác thực...'}
                    {uploadProgress.stage === 'done' && '100%'}
                  </span>
                </div>
                <div className="upload-progress-card__bar-track">
                  <div
                    className="upload-progress-card__bar-fill"
                    style={{ width: `${Math.max(4, uploadProgress.percent)}%` }}
                  />
                </div>
                <div className="upload-progress-card__footer">
                  <span className="upload-progress-card__bytes">
                    {formatBytes(uploadProgress.loaded)} / {formatBytes(uploadProgress.total)}
                  </span>
                  <span className="upload-progress-card__status">
                    {uploadProgress.stage === 'preparing' && 'Đang cấp quyền...'}
                    {uploadProgress.stage === 'uploading' &&
                      `Đang tải lên (${uploadProgress.percent}%)`}
                    {uploadProgress.stage === 'verifying' && 'Đang xác thực...'}
                    {uploadProgress.stage === 'done' && 'Hoàn tất!'}
                  </span>
                </div>
              </div>
            )}
          </fieldset>

          <fieldset>
            <legend>
              Distribution channels <small>Leave empty until your story goes live.</small>
            </legend>
            <label>
              <span className="channel-field-header">
                <FacebookIcon size={14} className="channel-icon--facebook" />
                <span>Facebook Post</span>
                {facebook && (
                  <a
                    href={getChannelUrl('facebook', facebook)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="channel-preview-link"
                    title="Mở bài đăng Facebook"
                  >
                    Xem bài đăng <ExternalLink size={11} />
                  </a>
                )}
              </span>
              <input
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="Post ID or URL (e.g. https://facebook.com/...)"
              />
            </label>
            <div className="form-grid">
              <label>
                <span className="channel-field-header">
                  <TikTokIcon size={14} className="channel-icon--tiktok" />
                  <span>TikTok Post</span>
                  {tiktok && (
                    <a
                      href={getChannelUrl('tiktok', tiktok)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="channel-preview-link"
                      title="Mở bài đăng TikTok"
                    >
                      Xem <ExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={tiktok}
                  onChange={(e) => setTiktok(e.target.value)}
                  placeholder="Post ID or URL"
                />
              </label>
              <label>
                <span className="channel-field-header">
                  <YouTubeIcon size={14} className="channel-icon--youtube" />
                  <span>YouTube Post</span>
                  {youtube && (
                    <a
                      href={getChannelUrl('youtube', youtube)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="channel-preview-link"
                      title="Mở bài đăng YouTube"
                    >
                      Xem <ExternalLink size={11} />
                    </a>
                  )}
                </span>
                <input
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                  placeholder="Post ID or URL"
                />
              </label>
            </div>
          </fieldset>

          <div className="modal__actions drawer__actions">
            <button type="button" className="button button--secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="button button--primary" disabled={busy || uploading}>
              {busy ? 'Saving…' : 'Save content'}
            </button>
          </div>
        </form>
      </Drawer>

      {/* Secondary Media Picker Modal */}
      {isPickerOpen && (
        <MediaPickerModal
          api={api}
          selectedIds={selected}
          initialMedia={Array.from(knownMedia.values())}
          onClose={() => setIsPickerOpen(false)}
          onConfirm={(newSelectedIds, newMediaList) => {
            setSelected(newSelectedIds);
            setKnownMedia((prev) => {
              const map = new Map(prev);
              newMediaList.forEach((m) => map.set(m.id, m));
              return map;
            });
          }}
        />
      )}
    </>
  );
}
