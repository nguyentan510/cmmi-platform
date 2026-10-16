import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ChannelBadge, getChannelUrl } from '../components/Shared';

describe('getChannelUrl helper', () => {
  test('returns full URL unchanged if already an http/https link', () => {
    expect(getChannelUrl('facebook', 'https://facebook.com/custom/posts/123')).toBe(
      'https://facebook.com/custom/posts/123',
    );
    expect(getChannelUrl('tiktok', 'https://www.tiktok.com/@creator/video/999')).toBe(
      'https://www.tiktok.com/@creator/video/999',
    );
    expect(getChannelUrl('youtube', 'https://youtu.be/watch?v=abc')).toBe(
      'https://youtu.be/watch?v=abc',
    );
  });

  test('normalizes raw post IDs into standard social media permalinks', () => {
    expect(getChannelUrl('facebook', '10023456789')).toBe('https://facebook.com/10023456789');
    expect(getChannelUrl('tiktok', '7123456789012345678')).toBe(
      'https://www.tiktok.com/@/video/7123456789012345678',
    );
    expect(getChannelUrl('tiktok', '@cmmi_agency/video/111')).toBe(
      'https://www.tiktok.com/@cmmi_agency/video/111',
    );
    expect(getChannelUrl('youtube', 'dQw4w9WgXcQ')).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    );
  });

  test('returns empty string when value is null, undefined or whitespace', () => {
    expect(getChannelUrl('facebook', null)).toBe('');
    expect(getChannelUrl('tiktok', undefined)).toBe('');
    expect(getChannelUrl('youtube', '   ')).toBe('');
  });
});

describe('ChannelBadge Component', () => {
  test('renders connected anchor with target=_blank, tooltip, and prevents row click bubbling', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick} data-testid="row">
        <ChannelBadge channel="facebook" value="123456" />
      </div>,
    );

    const link = screen.getByRole('link', { name: /Facebook: https:\/\/facebook\.com\/123456/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://facebook.com/123456');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveClass('channel', 'channel--connected', 'channel--facebook');

    // Tooltip contents
    expect(screen.getByText('Đã liên kết')).toBeInTheDocument();
    expect(screen.getByText('https://facebook.com/123456')).toBeInTheDocument();
    expect(screen.getByText(/Mở bài đăng/i)).toBeInTheDocument();

    // Click link should trigger stopPropagation and not fire parent row click
    fireEvent.click(link);
    expect(parentClick).not.toHaveBeenCalled();
  });

  test('renders disabled badge when post id is missing', () => {
    render(<ChannelBadge channel="youtube" value="" />);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    const disabledBadge = screen.getByLabelText(/YouTube: Chưa đăng bài/i);
    expect(disabledBadge).toBeInTheDocument();
    expect(disabledBadge).toHaveClass('channel', 'channel--disabled', 'channel--youtube');
    expect(screen.getByText('Chưa đăng')).toBeInTheDocument();
    expect(screen.getByText('Chưa liên kết bài đăng')).toBeInTheDocument();
  });

  test('renders TikTok brand badge with correct styling classes', () => {
    render(<ChannelBadge channel="tiktok" value="7890" />);

    const link = screen.getByRole('link');
    expect(link).toHaveClass('channel--tiktok');
    expect(link).toHaveAttribute('href', 'https://www.tiktok.com/@/video/7890');
  });
});
