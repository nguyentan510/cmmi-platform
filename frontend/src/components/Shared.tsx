import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Inbox,
  Maximize2,
  Minimize2,
  Play,
  Video,
  X,
} from 'lucide-react';
import type { Media, Status } from '../services/api';

export function ErrorBox({ message }: { message?: string }) {
  return message ? (
    <div className="notice notice--error" role="alert">
      <CircleAlert size={17} />
      {message}
    </div>
  ) : null;
}
export function Empty({
  title = 'Nothing here yet',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Inbox size={25} />
      </div>
      <h3>{title}</h3>
      <p>{children ?? 'Create your first item to get started.'}</p>
    </div>
  );
}
export function Badge({ status }: { status: Status }) {
  return (
    <span className={`badge badge--${status.toLowerCase()}`}>
      <span />
      {status[0] + status.slice(1).toLowerCase()}
    </span>
  );
}
export function Pager({
  offset,
  length,
  onChange,
}: {
  offset: number;
  length: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="pager">
      <span>{length ? `${offset + 1}–${offset + length}` : '0'} items · 50 per page</span>
      <div>
        <button
          aria-label="Previous page"
          disabled={!offset}
          onClick={() => onChange(Math.max(0, offset - 50))}
        >
          <ChevronLeft size={16} />
        </button>
        <button aria-label="Next page" disabled={length < 50} onClick={() => onChange(offset + 50)}>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
export function MediaPreview({
  media,
  onRatioDetect,
}: {
  media: Media;
  onRatioDetect?: (ratio: string) => void;
}) {
  const [ratio, setRatio] = useState<string | null>(null);

  const handleVideoMeta = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) {
      const r = v.videoWidth / v.videoHeight;
      const detected =
        r < 0.65 ? '9:16' : r < 0.85 ? '4:5' : r <= 1.2 ? '1:1' : r > 1.55 ? '16:9' : '4:3';
      setRatio(detected);
      if (onRatioDetect) onRatioDetect(detected);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (img.naturalWidth && img.naturalHeight) {
      const r = img.naturalWidth / img.naturalHeight;
      const detected =
        r < 0.65 ? '9:16' : r < 0.85 ? '4:5' : r <= 1.2 ? '1:1' : r > 1.55 ? '16:9' : '4:3';
      setRatio(detected);
      if (onRatioDetect) onRatioDetect(detected);
    }
  };

  if (media.is_cleaned) {
    return <div className="media-placeholder">Storage released</div>;
  }
  if (!media.upload_confirmed) {
    return <div className="media-placeholder">Awaiting upload</div>;
  }

  return (
    <>
      {media.media_type === 'VIDEO' ? (
        <video
          controls
          preload="metadata"
          src={media.public_url}
          aria-label={media.file_name}
          onLoadedMetadata={handleVideoMeta}
          playsInline
        />
      ) : (
        <img
          src={media.public_url}
          alt={media.file_name}
          loading="lazy"
          onLoad={handleImageLoad}
        />
      )}
      {ratio && <span className="media-card__ratio">{ratio}</span>}
    </>
  );
}

export const videoThumbnailCache = new Map<string, string>();

export function VideoThumbnail({
  src,
  alt = '',
}: {
  src: string;
  alt?: string;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(() => videoThumbnailCache.get(src) ?? null);
  const [loadError, setLoadError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!src) return;
    if (videoThumbnailCache.has(src)) {
      setThumbUrl(videoThumbnailCache.get(src)!);
      return;
    }

    if (typeof document === 'undefined') return;

    let isMounted = true;
    let video: HTMLVideoElement | null = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    try {
      video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';

      const videoSrc = src.includes('#') ? src : `${src}#t=0.001`;
      video.src = videoSrc;
    } catch {
      return;
    }

    const cleanUp = () => {
      if (!video) return;
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      clearTimeout(timeoutId);
      try {
        video.removeAttribute('src');
        if (typeof video.load === 'function' && !navigator.userAgent.includes('jsdom')) {
          video.load();
        }
      } catch {
        /* ignore */
      }
    };

    const tryCapture = () => {
      if (!isMounted || !video) return;
      try {
        if (!video.videoWidth || !video.videoHeight) return;
        const canvas = document.createElement('canvas');
        const maxDim = 128;
        const aspect = video.videoWidth / video.videoHeight;
        let w = maxDim;
        let h = maxDim;
        if (aspect > 1) {
          h = Math.round(maxDim / aspect);
        } else {
          w = Math.round(maxDim * aspect);
        }
        canvas.width = Math.max(1, w);
        canvas.height = Math.max(1, h);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanUp();
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl && dataUrl.startsWith('data:image/')) {
          videoThumbnailCache.set(src, dataUrl);
          if (isMounted) {
            setThumbUrl(dataUrl);
          }
        }
        cleanUp();
      } catch {
        cleanUp();
      }
    };

    const onSeeked = () => {
      tryCapture();
    };

    const onLoadedData = () => {
      if (video && video.currentTime === 0) {
        try {
          video.currentTime = 0.001;
        } catch {
          tryCapture();
        }
      } else {
        tryCapture();
      }
    };

    const onError = () => {
      cleanUp();
    };

    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('error', onError);

    timeoutId = setTimeout(() => {
      cleanUp();
    }, 4000);

    return () => {
      isMounted = false;
      cleanUp();
    };
  }, [src]);

  if (thumbUrl) {
    return (
      <div className="content-thumb__video-wrap">
        <img src={thumbUrl} alt={alt} loading="lazy" />
        <span className="content-thumb__play-badge" aria-hidden="true" title="Video">
          <Play size={8} fill="currentColor" />
        </span>
      </div>
    );
  }

  if (!loadError) {
    return (
      <div className="content-thumb__video-wrap">
        <video
          ref={videoRef}
          src={src.includes('#') ? src : `${src}#t=0.001`}
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.currentTime === 0) {
              try {
                v.currentTime = 0.001;
              } catch {
                /* ignore */
              }
            }
          }}
          onError={() => setLoadError(true)}
        />
        <span className="content-thumb__play-badge" aria-hidden="true" title="Video">
          <Play size={8} fill="currentColor" />
        </span>
      </div>
    );
  }

  return <Video size={19} />;
}

export function Modal({
  title,
  children,
  onClose,
  className = '',
  backdropClassName = '',
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  backdropClassName?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current!;
    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>('input,textarea,select,button,[href]')).filter(
        (el) => !el.hasAttribute('disabled'),
      );
    focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className={`modal-backdrop ${backdropClassName}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${className}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header>
          <div>
            <span className="eyebrow">CONTENT STUDIO</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Drawer({
  title,
  eyebrow = 'CONTENT STUDIO',
  children,
  onClose,
  initialWidth = 740,
  minWidth = 460,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  initialWidth?: number;
  minWidth?: number;
}) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cmmi_drawer_width');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= minWidth && parsed <= window.innerWidth) {
          return Math.min(parsed, window.innerWidth - 32);
        }
      }
      return Math.min(initialWidth, typeof window !== 'undefined' ? window.innerWidth - 32 : initialWidth);
    }
    return initialWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const widthRef = useRef(width);
  widthRef.current = width;
  const preMaximizeWidthRef = useRef(width);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    if (!node) return;
    const focusable = () =>
      Array.from(node.querySelectorAll<HTMLElement>('input,textarea,select,button,[href]')).filter(
        (el) => !el.hasAttribute('disabled'),
      );
    focusable()[0]?.focus();
    const keydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', keydown);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isMaximized) setIsMaximized(false);
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = widthRef.current;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const effectiveMinWidth =
        typeof window !== 'undefined' ? Math.min(minWidth, window.innerWidth - 32) : minWidth;
      const maxW = typeof window !== 'undefined' ? window.innerWidth - 32 : 1400;
      const newWidth = Math.min(maxW, Math.max(effectiveMinWidth, startWidth + delta));
      widthRef.current = newWidth;
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      try {
        localStorage.setItem('cmmi_drawer_width', String(widthRef.current));
      } catch {
        /* ignore */
      }
    };

    document.body.style.cursor = 'col-resize';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      setWidth(preMaximizeWidthRef.current);
      setIsMaximized(false);
    } else {
      preMaximizeWidthRef.current = width;
      const fullW =
        typeof window !== 'undefined' ? Math.max(minWidth, window.innerWidth - 40) : 1200;
      setWidth(fullW);
      setIsMaximized(true);
    }
  };

  const handleDoubleClickHandle = () => {
    if (isMaximized) {
      setWidth(initialWidth);
      setIsMaximized(false);
    } else if (width >= (typeof window !== 'undefined' ? window.innerWidth - 80 : 1100)) {
      setWidth(initialWidth);
    } else {
      toggleMaximize();
    }
  };

  return (
    <div
      className={`drawer-backdrop modal-backdrop--drawer ${isDragging ? 'drawer-backdrop--dragging' : ''}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDragging) onClose();
      }}
    >
      <div
        className={`drawer-panel modal modal--drawer ${isDragging ? 'drawer-panel--dragging' : ''}`}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={{
          width: `${width}px`,
        }}
      >
        <div
          className="drawer-resize-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Kéo để thay đổi kích thước panel"
          title="Kéo sang trái để mở rộng kích thước, nhấp đúp để phóng to/thu nhỏ"
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClickHandle}
        >
          <div className="drawer-resize-handle__bar" />
        </div>
        <header className="drawer-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id="modal-title">{title}</h2>
          </div>
          <div className="drawer-header__actions">
            <button
              type="button"
              className="icon-button"
              aria-label={isMaximized ? 'Thu nhỏ kích thước panel' : 'Mở rộng toàn màn hình'}
              title={isMaximized ? 'Thu nhỏ kích thước panel' : 'Mở rộng toàn màn hình'}
              onClick={toggleMaximize}
            >
              {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
              <X size={21} />
            </button>
          </div>
        </header>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}
