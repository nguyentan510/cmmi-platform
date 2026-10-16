import { useRef, useState } from 'react';
import { ImagePlus, Loader2, Maximize2, Trash2, Upload } from 'lucide-react';
import { Drawer, Empty, ErrorBox, MediaPreview, Modal, Pager } from '../../components/Shared';
import {
  type Api,
  type Media,
  type UploadProgress,
  dateText,
  errorMessage,
  formatBytes,
  result,
  uploadMedia,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';

interface UploadState {
  fileIndex: number;
  totalFiles: number;
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
  stage: 'preparing' | 'uploading' | 'verifying' | 'done';
}

export default function MediaLibrary({ api }: { api: Api }) {
  const [filter, setFilter] = useState('active');
  const [viewRatio, setViewRatio] = useState<'contain' | 'portrait' | 'landscape' | 'square'>('contain');
  const [inspectingMedia, setInspectingMedia] = useState<Media | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadState | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const items = useLoad(
    () =>
      result(
        api.GET('/api/v1/media', {
          params: {
            query: {
              is_cleaned: filter === 'all' ? undefined : filter === 'cleaned',
              offset,
              limit: 50,
            },
          },
        }),
      ),
    [api, filter, offset],
  );

  async function upload(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    setUploadError('');
    setMessage('');
    setIsUploadOpen(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setUploadProgress({
          fileIndex: i + 1,
          totalFiles: files.length,
          fileName: file.name,
          loaded: 0,
          total: file.size,
          percent: 0,
          stage: 'preparing',
        });
        await uploadMedia(api, file, (progress: UploadProgress) => {
          setUploadProgress({
            fileIndex: i + 1,
            totalFiles: files.length,
            fileName: file.name,
            loaded: progress.loaded,
            total: progress.total,
            percent: progress.percent,
            stage: progress.stage ?? 'uploading',
          });
        });
      }
      setMessage(`${files.length} asset${files.length > 1 ? 's' : ''} uploaded and verified.`);
      items.reload();
    } catch (e) {
      setUploadError(errorMessage(e));
      items.reload();
    } finally {
      setBusy(false);
      setUploadProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  async function remove(item: Media) {
    if (
      !window.confirm(
        `Permanently remove “${item.file_name}” from storage? Its metadata will be retained.`,
      )
    )
      return;
    setError('');
    try {
      await result(
        api.DELETE('/api/v1/media/{media_id}', { params: { path: { media_id: item.id } } }),
      );
      items.reload();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <>
      <ErrorBox message={error || items.error} />
      {message && !isUploadOpen && (
        <div className="notice notice--success" role="status">
          {message}
        </div>
      )}

      <section
        className="panel"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('Files')) e.preventDefault();
        }}
        onDrop={(e) => {
          if (e.dataTransfer.files?.length) {
            e.preventDefault();
            void upload(Array.from(e.dataTransfer.files));
          }
        }}
      >
        <div className="panel__heading">
          <div>
            <h2>
              Your media collection <span className="count">{items.data?.length ?? 0}</span>
            </h2>
            <p>Original files, ready for their next chapter.</p>
          </div>
          <div className="panel__actions-group">
            <div className="filter-group">
              <select
                aria-label="Aspect ratio view"
                value={viewRatio}
                onChange={(e) =>
                  setViewRatio(e.target.value as 'contain' | 'portrait' | 'landscape' | 'square')
                }
              >
                <option value="contain">Khung hình: Tự nhiên (Contain)</option>
                <option value="portrait">Khung hình: Dọc 9:16 (Shorts/Reels)</option>
                <option value="landscape">Khung hình: Ngang 16:9 (Video)</option>
                <option value="square">Khung hình: Vuông 1:1 (Post)</option>
              </select>
              <select
                aria-label="Media status"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="active">Active assets</option>
                <option value="cleaned">Cleaned · storage released</option>
                <option value="all">All assets</option>
              </select>
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={() => {
                setIsUploadOpen(true);
                setUploadError('');
              }}
            >
              <Upload size={16} />
              Upload media
            </button>
          </div>
        </div>

        {items.loading ? (
          <div className="loading">Opening your library…</div>
        ) : items.data?.length ? (
          <div className={`media-grid ${viewRatio === 'portrait' ? 'media-grid--portrait' : ''}`}>
            {items.data.map((item) => (
              <article className={`media-card media-card--${viewRatio}`} key={item.id}>
                <div className="media-card__preview">
                  <MediaPreview media={item} />
                  <span className="media-card__type">{item.media_type}</span>
                  <button
                    type="button"
                    className="media-card__expand"
                    aria-label={`Xem chi tiết ${item.file_name}`}
                    title="Xem toàn màn hình (Lightbox)"
                    onClick={() => setInspectingMedia(item)}
                  >
                    <Maximize2 size={14} />
                  </button>
                </div>
                <div className="media-card__body">
                  <h3
                    title={item.file_name}
                    onClick={() => setInspectingMedia(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    {item.file_name}
                  </h3>
                  <p>
                    {formatBytes(item.file_size_bytes)} <span>·</span>{' '}
                    {item.is_cleaned ? 'Cleaned' : item.upload_confirmed ? 'Ready' : 'Pending'}
                  </p>
                  <div>
                    <small>{dateText(item.created_at)}</small>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <button
                        type="button"
                        aria-label={`Xem chi tiết ${item.file_name}`}
                        title="Xem toàn màn hình"
                        onClick={() => setInspectingMedia(item)}
                      >
                        <Maximize2 size={15} />
                      </button>
                      {!item.is_cleaned && (
                        <button
                          aria-label={`Delete ${item.file_name}`}
                          onClick={() => void remove(item)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="A blank canvas for your assets">
            Upload an image or video to start building your collection.
          </Empty>
        )}
        <Pager offset={offset} length={items.data?.length ?? 0} onChange={setOffset} />
      </section>

      {/* Upload Drawer Slide */}
      {isUploadOpen && (
        <Drawer
          title="Upload media"
          eyebrow="ASSET PIPELINE"
          onClose={() => {
            if (!busy) setIsUploadOpen(false);
          }}
          initialWidth={580}
          minWidth={420}
          storageKey="cmmi_drawer_media_width"
        >
          <div className="drawer-form">
            <div className="drawer-intro">
              <ImagePlus size={22} className="drawer-intro__icon" />
              <div>
                <h3>Add visual assets</h3>
                <p>
                  Direct upload to Cloudflare R2 with automatic integrity checks.
                  Files are retained and protected from accidental deletion.
                </p>
              </div>
            </div>

            <ErrorBox message={uploadError} />

            <div
              className="upload-zone upload-zone--drawer"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void upload(Array.from(e.dataTransfer.files));
              }}
            >
              <span>
                <ImagePlus size={32} strokeWidth={1.5} />
              </span>
              <div>
                <h4>{busy ? 'Uploading and verifying your files…' : 'Drop images or videos here'}</h4>
                <p>Supports JPEG, PNG, WebP, GIF, AVIF, MP4, WebM, QuickTime. Up to 5 GB per asset.</p>
              </div>
              <label className="button button--primary">
                <Upload size={16} />
                Browse files
                <input
                  ref={input}
                  aria-label="Upload media"
                  className="sr-only"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
                  disabled={busy}
                  onChange={(e) => void upload(Array.from(e.target.files ?? []))}
                />
              </label>
            </div>

            {uploadProgress && (
              <div className="upload-progress-card" role="status" aria-live="polite">
                <div className="upload-progress-card__header">
                  <div className="upload-progress-card__info">
                    <Loader2 size={16} className="spin" />
                    <span className="upload-progress-card__filename" title={uploadProgress.fileName}>
                      {uploadProgress.totalFiles > 1
                        ? `[${uploadProgress.fileIndex}/${uploadProgress.totalFiles}] `
                        : ''}
                      {uploadProgress.fileName}
                    </span>
                  </div>
                  <span className="upload-progress-card__badge">
                    {uploadProgress.stage === 'preparing' && 'Khởi tạo...'}
                    {uploadProgress.stage === 'uploading' && `${uploadProgress.percent}%`}
                    {uploadProgress.stage === 'verifying' && 'Xác thực R2...'}
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
                    {uploadProgress.stage === 'preparing' && 'Đang xin cấp phép lưu trữ...'}
                    {uploadProgress.stage === 'uploading' &&
                      `Đang tải lên Cloudflare R2 (${uploadProgress.percent}%)`}
                    {uploadProgress.stage === 'verifying' && 'Đang kiểm tra toàn vẹn tệp tin...'}
                    {uploadProgress.stage === 'done' && 'Tải lên hoàn tất!'}
                  </span>
                </div>
              </div>
            )}

            {message && (
              <div className="notice notice--success" role="status">
                {message}
              </div>
            )}

            <div className="modal__actions drawer__actions">
              <button
                type="button"
                className="button button--secondary"
                disabled={busy}
                onClick={() => setIsUploadOpen(false)}
              >
                {busy ? 'Uploading…' : 'Close'}
              </button>
            </div>
          </div>
        </Drawer>
      )}

      {inspectingMedia && (
        <Modal title={inspectingMedia.file_name} onClose={() => setInspectingMedia(null)}>
          <div className="media-lightbox">
            <div className="media-lightbox__stage">
              {inspectingMedia.media_type === 'VIDEO' ? (
                <video
                  controls
                  autoPlay
                  playsInline
                  src={inspectingMedia.public_url}
                  aria-label={inspectingMedia.file_name}
                />
              ) : (
                <img src={inspectingMedia.public_url} alt={inspectingMedia.file_name} />
              )}
            </div>
            <div className="media-lightbox__meta">
              <div>
                <span>Loại tệp:</span> <strong>{inspectingMedia.media_type} ({inspectingMedia.mime_type})</strong>
              </div>
              <div>
                <span>Dung lượng:</span> <strong>{formatBytes(inspectingMedia.file_size_bytes)}</strong>
              </div>
              <div>
                <span>Ngày tạo:</span> <strong>{dateText(inspectingMedia.created_at)}</strong>
              </div>
              <div>
                <a
                  href={inspectingMedia.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={inspectingMedia.file_name}
                  className="button button--secondary"
                >
                  Tải tệp gốc
                </a>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
