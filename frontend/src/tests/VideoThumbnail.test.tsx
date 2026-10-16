import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { VideoThumbnail, videoThumbnailCache } from '../components/Shared';
import ContentManager from '../pages/ContentManager/ContentManager';
import type { Api, Content } from '../services/api';

describe('VideoThumbnail Component', () => {
  beforeEach(() => {
    videoThumbnailCache.clear();
  });

  test('renders video element with #t=0.001 when no cached thumbnail exists', () => {
    render(<VideoThumbnail src="https://media.example.com/demo.mp4" alt="Demo Video" />);

    const videoEl = document.querySelector('video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl?.getAttribute('src')).toBe('https://media.example.com/demo.mp4#t=0.001');
    expect(videoEl?.getAttribute('preload')).toBe('metadata');
  });

  test('preserves existing media fragments in video src', () => {
    render(<VideoThumbnail src="https://media.example.com/demo.mp4#t=1.5" alt="Demo Video" />);

    const videoEl = document.querySelector('video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl?.getAttribute('src')).toBe('https://media.example.com/demo.mp4#t=1.5');
  });

  test('renders cached captured dataUrl image immediately', () => {
    const fakeDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    videoThumbnailCache.set('https://media.example.com/cached.mp4', fakeDataUrl);

    render(<VideoThumbnail src="https://media.example.com/cached.mp4" alt="Cached Video" />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();
    expect(img.getAttribute('src')).toBe(fakeDataUrl);
    expect(img.getAttribute('alt')).toBe('Cached Video');
  });

  test('renders play badge overlay indicator for visual cue', () => {
    const fakeDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
    videoThumbnailCache.set('https://media.example.com/cached.mp4', fakeDataUrl);

    render(<VideoThumbnail src="https://media.example.com/cached.mp4" alt="Cached Video" />);

    const badge = document.querySelector('.content-thumb__play-badge');
    expect(badge).toBeInTheDocument();
  });
});

describe('ContentManager Table Content Visual Display', () => {
  function createMockApi(data: Content[]) {
    return {
      GET: vi.fn().mockResolvedValue({
        data,
        error: undefined,
        response: new Response(JSON.stringify(data), { status: 200 }),
      }),
    } as unknown as Api;
  }

  test('displays video thumbnail when content item has a video asset', async () => {
    const videoContent: Content = {
      id: 'video-content-1',
      author_id: 'user-1',
      title: 'Shorts Video Launch',
      body: 'Check out our new feature in action',
      status: 'PUBLISHED',
      scheduled_at: null,
      published_at: '2026-10-16T12:00:00Z',
      created_at: '2026-10-16T10:00:00Z',
      fb_post_id: '',
      tiktok_post_id: 'tiktok_123',
      youtube_post_id: 'yt_456',
      media_assets: [
        {
          id: 'media-video-1',
          uploader_id: 'user-1',
          file_name: 'promo.mp4',
          public_url: 'https://media.example.com/promo.mp4',
          media_type: 'VIDEO',
          mime_type: 'video/mp4',
          file_size_bytes: 10485760,
          is_cleaned: false,
          upload_confirmed: true,
          created_at: '2026-10-16T10:00:00Z',
        },
      ],
    };

    render(<ContentManager api={createMockApi([videoContent])} onHelp={() => {}} />);

    expect(await screen.findByText('Shorts Video Launch')).toBeInTheDocument();

    const videoEl = document.querySelector('.content-thumb video');
    expect(videoEl).toBeInTheDocument();
    expect(videoEl?.getAttribute('src')).toBe('https://media.example.com/promo.mp4#t=0.001');

    const playBadge = document.querySelector('.content-thumb__play-badge');
    expect(playBadge).toBeInTheDocument();
  });

  test('displays image thumbnail when content item has an image asset', async () => {
    const imageContent: Content = {
      id: 'image-content-1',
      author_id: 'user-1',
      title: 'Photo Banner Post',
      body: 'Autumn promo graphics',
      status: 'DRAFT',
      scheduled_at: null,
      published_at: null,
      created_at: '2026-10-16T10:00:00Z',
      fb_post_id: '',
      tiktok_post_id: '',
      youtube_post_id: '',
      media_assets: [
        {
          id: 'media-img-1',
          uploader_id: 'user-1',
          file_name: 'banner.jpg',
          public_url: 'https://media.example.com/banner.jpg',
          media_type: 'IMAGE',
          mime_type: 'image/jpeg',
          file_size_bytes: 204800,
          is_cleaned: false,
          upload_confirmed: true,
          created_at: '2026-10-16T10:00:00Z',
        },
      ],
    };

    render(<ContentManager api={createMockApi([imageContent])} onHelp={() => {}} />);

    expect(await screen.findByText('Photo Banner Post')).toBeInTheDocument();

    const imgEl = document.querySelector('.content-thumb img');
    expect(imgEl).toBeInTheDocument();
    expect(imgEl?.getAttribute('src')).toBe('https://media.example.com/banner.jpg');
  });

  test('displays document fallback icon when content has no media attachments', async () => {
    const textContent: Content = {
      id: 'text-content-1',
      author_id: 'user-1',
      title: 'Text Story Only',
      body: 'Simple announcement',
      status: 'DRAFT',
      scheduled_at: null,
      published_at: null,
      created_at: '2026-10-16T10:00:00Z',
      fb_post_id: '',
      tiktok_post_id: '',
      youtube_post_id: '',
      media_assets: [],
    };

    render(<ContentManager api={createMockApi([textContent])} onHelp={() => {}} />);

    expect(await screen.findByText('Text Story Only')).toBeInTheDocument();

    const videoEl = document.querySelector('.content-thumb video');
    const imgEl = document.querySelector('.content-thumb img');
    expect(videoEl).not.toBeInTheDocument();
    expect(imgEl).not.toBeInTheDocument();

    const icon = document.querySelector('.content-thumb svg');
    expect(icon).toBeInTheDocument();
  });
});
