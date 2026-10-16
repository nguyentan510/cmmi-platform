import { useCallback, useState, type FormEvent } from 'react';
import { ImagePlus, Loader2, Upload } from 'lucide-react';
import { ErrorBox, Modal } from '../../components/Shared';
import {
  type Api,
  type Content,
  type ContentInput,
  type Status,
  type UploadProgress,
  errorMessage,
  formatBytes,
  localDateTime,
  result,
  uploadMedia,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';

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
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    loaded: number;
    total: number;
    percent: number;
    stage: 'preparing' | 'uploading' | 'verifying' | 'done';
  } | null>(null);
  const [error, setError] = useState('');
  const [mediaOffset, setMediaOffset] = useState(0);
  const library = useLoad(
    () =>
      result(
        api.GET('/api/v1/media', {
          params: { query: { is_cleaned: false, offset: mediaOffset, limit: 50 } },
        }),
      ),
    [api, mediaOffset],
  );
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
      setSelected((previous) => [...previous, item.id]);
      library.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }
  return (
    <Modal title={content ? 'Edit your story' : 'Create a new story'} onClose={close}>
      <form onSubmit={save} className="editor">
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
        <fieldset>
          <legend>
            <ImagePlus size={17} />
            Media attachments{' '}
            <small>{selected.length} selected · selection order is display order</small>
          </legend>
          <div className="attachment-list">
            {content?.media_assets
              .filter((m) => m.is_cleaned)
              .map((item) => (
                <label key={item.id} className="attachment">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={() =>
                      setSelected((previous) => previous.filter((id) => id !== item.id))
                    }
                  />
                  {item.file_name}
                  <small>Cleaned · history only</small>
                </label>
              ))}
            {library.data
              ?.filter((m) => m.upload_confirmed)
              .map((item) => (
                <label key={item.id} className="attachment">
                  <input
                    type="checkbox"
                    checked={selected.includes(item.id)}
                    onChange={(e) =>
                      setSelected((previous) =>
                        e.target.checked
                          ? [...previous, item.id]
                          : previous.filter((id) => id !== item.id),
                      )
                    }
                  />
                  <span>{item.file_name}</span>
                  <small>
                    {selected.includes(item.id)
                      ? `#${selected.indexOf(item.id) + 1}`
                      : item.media_type}
                  </small>
                </label>
              ))}
            {!library.loading && !library.data?.length && (
              <p>No active media yet. Upload your first asset below.</p>
            )}
          </div>
          {uploadProgress && (
            <div
              className="upload-progress-card upload-progress-card--compact"
              role="status"
              aria-live="polite"
            >
              <div className="upload-progress-card__header">
                <div className="upload-progress-card__info">
                  <Loader2 size={14} className="spin" />
                  <span className="upload-progress-card__filename" title={uploadProgress.fileName}>
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
                  {uploadProgress.stage === 'uploading' && `Đang tải lên (${uploadProgress.percent}%)`}
                  {uploadProgress.stage === 'verifying' && 'Đang xác thực...'}
                  {uploadProgress.stage === 'done' && 'Hoàn tất!'}
                </span>
              </div>
            </div>
          )}
          <div className="attachment-actions">
            <label className="button button--secondary">
              <Upload size={15} />
              {uploading ? 'Uploading…' : 'Upload an asset'}
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
              disabled={!mediaOffset}
              onClick={() => setMediaOffset(mediaOffset - 50)}
            >
              Previous assets
            </button>
            <button
              type="button"
              disabled={(library.data?.length ?? 0) < 50}
              onClick={() => setMediaOffset(mediaOffset + 50)}
            >
              More assets
            </button>
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Distribution channels <small>Leave empty until your story goes live.</small>
          </legend>
          <label>
            Facebook Post
            <input
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Post ID or URL"
            />
          </label>
          <div className="form-grid">
            <label>
              TikTok Post
              <input
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="Post ID or URL"
              />
            </label>
            <label>
              YouTube Post
              <input
                value={youtube}
                onChange={(e) => setYoutube(e.target.value)}
                placeholder="Post ID or URL"
              />
            </label>
          </div>
        </fieldset>
        <div className="modal__actions">
          <button type="button" className="button button--secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button button--primary" disabled={busy || uploading}>
            {busy ? 'Saving…' : 'Save content'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
