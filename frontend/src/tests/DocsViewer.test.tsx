import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import DocsViewer from '../pages/DocsViewer/DocsViewer';

describe('DocsViewer - Prompt Builder & Live Config Generator', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  test('CMMI Base URL is fixed to server URL, read-only and disabled from manual editing', () => {
    render(<DocsViewer />);

    const urlInput = screen.getByLabelText(/CMMI Base URL \(Tự động bám theo Server\):/i) as HTMLInputElement;
    expect(urlInput).toBeInTheDocument();
    expect(urlInput).toHaveAttribute('readonly');
    expect(urlInput).toBeDisabled();
    expect(screen.getByText('Cố định theo Server')).toBeInTheDocument();
    expect(screen.getByText(/URL máy chủ chính thức được tự động đồng bộ từ Backend API/i)).toBeInTheDocument();

    // Verify user cannot change value via change event
    fireEvent.change(urlInput, { target: { value: 'https://attacker-domain.com' } });
    expect(urlInput.value).not.toBe('https://attacker-domain.com');
  });

  test('displays warning badge, warning box, and navigation button when API key is empty', () => {
    const handleNavigate = vi.fn();
    render(<DocsViewer onNavigateToApiKeys={handleNavigate} />);

    // Check warning badge
    expect(screen.getByText(/Chưa điền API Key/i)).toBeInTheDocument();

    // Check warning box
    expect(
      screen.getByText(/Chưa có API Key\? Bạn cần tạo API Key để cấp quyền xác thực cho AI Agent\./i),
    ).toBeInTheDocument();

    // Check callout in Card Build Prompt
    expect(screen.getByText(/Chưa có API Key trong Build Prompt:/i)).toBeInTheDocument();

    // Check navigation buttons to API keys area
    const navButtons = screen.getAllByRole('button', { name: /Đi tới khu vực tạo API Key/i });
    expect(navButtons.length).toBeGreaterThanOrEqual(1);

    // Clicking navigation button triggers onNavigateToApiKeys
    fireEvent.click(navButtons[0]);
    expect(handleNavigate).toHaveBeenCalledTimes(1);
  });

  test('warning disappears and success state appears when user enters an API key', () => {
    render(<DocsViewer />);

    const apiKeyInput = screen.getByLabelText(/API Key của bạn:/i) as HTMLInputElement;
    expect(apiKeyInput).toBeInTheDocument();

    // Type API key
    fireEvent.change(apiKeyInput, { target: { value: 'cmmi_live_testkey123' } });

    // Warning badge should switch to Ready
    expect(screen.getByText('Đã sẵn sàng')).toBeInTheDocument();
    expect(screen.queryByText('Chưa điền API Key')).not.toBeInTheDocument();

    // Success message should appear
    expect(
      screen.getByText(/Đã nạp API Key vào mẫu cấu hình và Build Prompt bên dưới\./i),
    ).toBeInTheDocument();

    // Warning callout in build prompt card should disappear
    expect(screen.queryByText(/Chưa có API Key trong Build Prompt:/i)).not.toBeInTheDocument();

    // Build prompt and configs should contain the entered API key
    expect(screen.getAllByText(/CMMI_API_KEY=cmmi_live_testkey123/i).length).toBeGreaterThanOrEqual(1);

    // Clearing API key restores warning state
    const clearBtn = screen.getByLabelText('Xóa API Key');
    fireEvent.click(clearBtn);

    expect(screen.getByText('Chưa điền API Key')).toBeInTheDocument();
    expect(
      screen.getByText(/Chưa có API Key\? Bạn cần tạo API Key để cấp quyền xác thực cho AI Agent\./i),
    ).toBeInTheDocument();
  });
});
