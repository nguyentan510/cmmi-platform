import { useMemo, useState } from 'react';
import {
  Check,
  Film,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Plus,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { Empty, ErrorBox, Modal, Pager, VideoThumbnail } from '../../components/Shared';
import {
  type Api,
  type Media,
  type UploadProgress,
  errorMessage,
  formatBytes,
  result,
  uploadMedia,
} from '../../services/api';
import { useLoad } from '../../services/useLoad';

export default function MediaPickerModal({
  api,
  selectedIds,
  initialMedia = [],
  onConfirm,
  onClose,
}: {
  api: Api;
  selectedIds: string[];
  initialMedia?: Media[];
  onConfirm: (selectedIds: string[], selectedMedia: Media[]) => void;
  onClose: () => void;
}) {
  const [draftSelected, setDraftSelected] = useState<string[]>(() => [...selectedIds]);
  const [filterType, setFilterType] = useState<'ALL' | 'IMAGE' | 'VIDEO'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaOffset, setMediaOffset] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    fileName: string;
    loaded: number;
    total: number;
    percent: number;
    stage: 'preparing' | 'uploading' | 'verifying' | 'done';
  } | null>(null);
  const [error, setError] = useState('');
  const [extraUploaded, setExtraUploaded] = useState<Media[]>([]);

  const library = useLoad(
    () =>
      result(
        api.GET('/api/v1/media', {
          params: { query: { is_cleaned: false, offset: mediaOffset, limit: 50 } },
        }),
      ),
    [api, mediaOffset],
  );

  // Maintain a consolidated map of all known media assets across views and uploads
  const mediaMap = useMemo(() => {
    const map = new Map<string, Media>();
    initialMedia.forEach((m) => map.set(m.id, m));
    extraUploaded.forEach((m) => map.set(m.id, m));
    (library.data ?? []).forEach((m) => map.set(m.id, m));
    return map;
  }, [initialMedia, extraUploaded, library.data]);

  // Combine library list with extra uploaded items (ensuring no duplicates)
  const combinedMediaList = useMemo(() => {
    const ids = new Set<string>();
    const list: Media[] = [];

    // Prioritize extra uploaded
    extraUploaded.forEach((item) => {
      if (!ids.has(item.id)) {
        ids.add(item.id);
        list.push(item);
      }
    });

    // Then library data
    (library.data ?? []).forEach((item) => {
      if (!ids.has(item.id)) {
        ids.add(item.id);
        list.push(item);
      }
    });

    return list;
  }, [extraUploaded, library.data]);

  // Filter based on active tab and search query
  const displayedMedia = useMemo(() => {
    return combinedMediaList
      .filter((m) => m.upload_confirmed && !m.is_cleaned)
      .filter((m) => {
        if (filterType === 'IMAGE') return m.media_type === 'IMAGE';
        if (filterType === 'VIDEO') return m.media_type === 'VIDEO';
        return true;
      })
      .filter((m) => {
        if (!searchQuery.trim()) return true;
        return m.file_name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      });
  }, [combinedMediaList, filterType, searchQuery]);

  const toggleSelect = (id: string) => {
    setDraftSelected((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  async function handleUpload(file?: File) {
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
      setExtraUploaded((prev) => [item, ...prev]);
      setDraftSelected((prev) => (prev.includes(item.id) ? prev : [...prev, item.id]));
      library.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  const handleApply = () => {
    const selectedMediaList = draftSelected
      .map((id) => mediaMap.get(id))
      .filter(Boolean) as Media[];
    onConfirm(draftSelected, selectedMediaList);
    onClose();
  };

  const imagesCount = combinedMediaList.filter((m) => m.media_type === 'IMAGE').length;
  const videosCount = combinedMediaList.filter((m) => m.media_type === 'VIDEO').length;

  return (
    <Modal
      title="Thư viện Media · Chọn tệp đính kèm"
      onClose={onClose}
      backdropClassName="modal-backdrop--picker"
      className="modal--media-picker"
    >
      <div className="media-picker">
        <ErrorBox message={error || library.error} />

        {/* Toolbar: Search, Filter Tabs, Upload */}
        <div className="media-picker__toolbar">
          <div className="media-picker__search">
            <Search size={16} className="media-picker__search-icon" />
            <input
              type="text"
              placeholder="Tìm theo tên tệp..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Tìm kiếm tệp media"
            />
            {searchQuery && (
              <button
                type="button"
                className="media-picker__search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="media-picker__tabs">
            <button
              type="button"
              className={`media-picker__tab ${filterType === 'ALL' ? 'media-picker__tab--active' : ''}`}
              onClick={() => setFilterType('ALL')}
            >
              <Layers3 size={14} />
              Tất cả ({combinedMediaList.length})
            </button>
            <button
              type="button"
              className={`media-picker__tab ${filterType === 'IMAGE' ? 'media-picker__tab--active' : ''}`}
              onClick={() => setFilterType('IMAGE')}
            >
              <ImageIcon size={14} />
              Hình ảnh ({imagesCount})
            </button>
            <button
              type="button"
              className={`media-picker__tab ${filterType === 'VIDEO' ? 'media-picker__tab--active' : ''}`}
              onClick={() => setFilterType('VIDEO')}
            >
              <Film size={14} />
              Video ({videosCount})
            </button>
          </div>

          <label className="button button--secondary button--sm media-picker__upload-btn">
            <Upload size={14} />
            {uploading ? 'Đang tải lên…' : 'Tải tệp mới'}
            <input
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime"
              disabled={uploading}
              onChange={(e) => void handleUpload(e.target.files?.[0])}
            />
          </label>
        </div>

        {/* Upload Progress Bar if uploading */}
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

        {/* Visual Media Grid */}
        <div className="media-picker__grid-container">
          {displayedMedia.length > 0 ? (
            <div className="media-picker__grid" role="listbox" aria-label="Danh sách tệp media">
              {displayedMedia.map((item) => {
                const isSelected = draftSelected.includes(item.id);
                const orderIndex = isSelected ? draftSelected.indexOf(item.id) + 1 : null;

                return (
                  <div
                    key={item.id}
                    className={`media-picker-card ${isSelected ? 'media-picker-card--selected' : ''}`}
                    onClick={() => toggleSelect(item.id)}
                    role="option"
                    aria-selected={isSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleSelect(item.id);
                      }
                    }}
                    title={`${item.file_name} (${item.media_type}, ${formatBytes(item.file_size_bytes)})`}
                  >
                    {/* Visual Media Element */}
                    <div className="media-picker-card__thumb">
                      {item.media_type === 'VIDEO' ? (
                        <VideoThumbnail src={item.public_url} alt={item.file_name} />
                      ) : (
                        <img src={item.public_url} alt={item.file_name} loading="lazy" />
                      )}
                    </div>

                    {/* Selection Badges */}
                    {isSelected && (
                      <div className="media-picker-card__order-badge" title={`Thứ tự đính kèm #${orderIndex}`}>
                        #{orderIndex}
                      </div>
                    )}

                    <div
                      className={`media-picker-card__checkbox ${
                        isSelected ? 'media-picker-card__checkbox--checked' : ''
                      }`}
                    >
                      {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                    </div>

                    {/* Visual Scrim with Filename & Size */}
                    <div className="media-picker-card__scrim">
                      <span className="media-picker-card__filename">{item.file_name}</span>
                      <span className="media-picker-card__meta">
                        {item.media_type === 'VIDEO' ? 'Video' : 'Hình ảnh'} · {formatBytes(item.file_size_bytes)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              title={searchQuery ? 'Không tìm thấy media phù hợp' : 'Chưa có tệp media nào'}
            >
              {searchQuery
                ? 'Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.'
                : 'Tải lên hình ảnh hoặc video đầu tiên bằng nút "Tải tệp mới" phía trên.'}
            </Empty>
          )}
        </div>

        {/* Pager if large library */}
        <div className="media-picker__pagination">
          <Pager
            offset={mediaOffset}
            length={library.data?.length ?? 0}
            onChange={setMediaOffset}
          />
        </div>

        {/* Modal Actions Footer */}
        <div className="media-picker__footer">
          <div className="media-picker__footer-info">
            <span>
              Đã chọn: <strong>{draftSelected.length}</strong> tệp đa phương tiện
            </span>
            {draftSelected.length > 0 && (
              <button
                type="button"
                className="media-picker__clear-btn"
                onClick={() => setDraftSelected([])}
              >
                Bỏ chọn tất cả
              </button>
            )}
          </div>
          <div className="media-picker__footer-actions">
            <button type="button" className="button button--secondary" onClick={onClose}>
              Hủy
            </button>
            <button
              type="button"
              className="button button--primary"
              onClick={handleApply}
              disabled={uploading}
            >
              <Check size={16} />
              Áp dụng lựa chọn ({draftSelected.length})
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
