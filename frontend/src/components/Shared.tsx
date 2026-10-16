import { type ReactNode, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CircleAlert, Inbox, X } from 'lucide-react';
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
export function MediaPreview({ media }: { media: Media }) {
  return media.is_cleaned ? (
    <div className="media-placeholder">Storage released</div>
  ) : !media.upload_confirmed ? (
    <div className="media-placeholder">Awaiting upload</div>
  ) : media.media_type === 'VIDEO' ? (
    <video controls preload="metadata" src={media.public_url} aria-label={media.file_name} />
  ) : (
    <img src={media.public_url} alt={media.file_name} loading="lazy" />
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
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
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal"
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
