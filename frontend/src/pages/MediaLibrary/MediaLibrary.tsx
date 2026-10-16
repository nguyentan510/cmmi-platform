import { useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { Empty, ErrorBox, MediaPreview, Pager } from '../../components/Shared';
import {
  type Api,
  type Media,
  dateText,
  errorMessage,
  formatBytes,
  result,
  uploadMedia,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';

export default function MediaLibrary({ api }: { api: Api }) {
  const [filter, setFilter] = useState('active');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
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
    setError('');
    setMessage('');
    try {
      for (const file of files) await uploadMedia(api, file);
      setMessage(`${files.length} asset${files.length > 1 ? 's' : ''} uploaded and verified.`);
      items.reload();
    } catch (e) {
      setError(errorMessage(e));
      items.reload();
    } finally {
      setBusy(false);
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
      <div
        className="upload-zone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void upload(Array.from(e.dataTransfer.files));
        }}
      >
        <span>
          <ImagePlus size={27} strokeWidth={1.5} />
        </span>
        <div>
          <h2>{busy ? 'Uploading and verifying your files…' : 'A place for every frame.'}</h2>
          <p>Drop images or videos here, or browse your files. Up to 5 GB per asset.</p>
        </div>
        <label className="button button--primary">
          <Upload size={16} />
          Upload media
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
      <ErrorBox message={error || items.error} />
      {message && (
        <div className="notice notice--success" role="status">
          {message}
        </div>
      )}
      <section className="panel">
        <div className="panel__heading">
          <div>
            <h2>Your media collection</h2>
            <p>Original files, ready for their next chapter.</p>
          </div>
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
        {items.loading ? (
          <div className="loading">Opening your library…</div>
        ) : items.data?.length ? (
          <div className="media-grid">
            {items.data.map((item) => (
              <article className="media-card" key={item.id}>
                <div className="media-card__preview">
                  <MediaPreview media={item} />
                  <span className="media-card__type">{item.media_type}</span>
                </div>
                <div className="media-card__body">
                  <h3 title={item.file_name}>{item.file_name}</h3>
                  <p>
                    {formatBytes(item.file_size_bytes)} <span>·</span>{' '}
                    {item.is_cleaned ? 'Cleaned' : item.upload_confirmed ? 'Ready' : 'Pending'}
                  </p>
                  <div>
                    <small>{dateText(item.created_at)}</small>
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
    </>
  );
}
