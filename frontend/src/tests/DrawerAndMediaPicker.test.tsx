import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Drawer } from '../components/Shared';
import ContentEditor from '../pages/ContentManager/ContentEditor';
import MediaPickerModal from '../pages/ContentManager/MediaPickerModal';
import UserManager from '../pages/Users/Users';
import ApiKeys from '../pages/ApiKeys/ApiKeys';
import MediaLibrary from '../pages/MediaLibrary/MediaLibrary';
import type { Api, Content, Media, User } from '../services/api';

describe('Drawer Component', () => {
  test('renders with accessible dialog role, title, and close button', () => {
    const onClose = vi.fn();
    render(
      <Drawer title="Test Drawer" onClose={onClose}>
        <p>Drawer content</p>
      </Drawer>,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Test Drawer' })).toBeInTheDocument();
    expect(screen.getByText('CONTENT STUDIO')).toBeInTheDocument();
    expect(screen.getByText('Drawer content')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Close dialog' });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  test('renders resize handle and responds to drag interactions', () => {
    const onClose = vi.fn();
    render(
      <Drawer title="Resizable Drawer" onClose={onClose} initialWidth={600}>
        <p>Panel body</p>
      </Drawer>,
    );

    const handle = screen.getByRole('separator', { name: 'Kéo để thay đổi kích thước panel' });
    expect(handle).toBeInTheDocument();

    const panel = screen.getByRole('dialog');
    expect(panel).toHaveStyle({ width: '600px' });

    // Drag handle leftwards by 100px (startX: 500, move to 400 => delta: +100px)
    fireEvent.mouseDown(handle, { clientX: 500 });
    fireEvent.mouseMove(document, { clientX: 400 });
    fireEvent.mouseUp(document);

    expect(panel).toHaveStyle({ width: '700px' });
  });

  test('toggles maximize width using maximize button and handle double-click', () => {
    render(
      <Drawer title="Maximizable Drawer" onClose={() => {}} initialWidth={500}>
        <p>Content</p>
      </Drawer>,
    );

    const panel = screen.getByRole('dialog');
    const maxBtn = screen.getByRole('button', { name: 'Mở rộng toàn màn hình' });
    expect(maxBtn).toBeInTheDocument();

    fireEvent.click(maxBtn);
    expect(screen.getByRole('button', { name: 'Thu nhỏ kích thước panel' })).toBeInTheDocument();

    // Clicking restore
    fireEvent.click(screen.getByRole('button', { name: 'Thu nhỏ kích thước panel' }));
    expect(panel).toHaveStyle({ width: '500px' });

    // Double clicking resize handle
    const handle = screen.getByRole('separator');
    fireEvent.doubleClick(handle);
    expect(screen.getByRole('button', { name: 'Thu nhỏ kích thước panel' })).toBeInTheDocument();
  });
});

describe('MediaPickerModal & ContentEditor Visual Media Flow', () => {
  const sampleMedia: Media[] = [
    {
      id: 'img-1',
      uploader_id: 'user-1',
      file_name: 'hero-banner.jpg',
      public_url: 'https://media.example.com/hero-banner.jpg',
      media_type: 'IMAGE',
      mime_type: 'image/jpeg',
      file_size_bytes: 524288,
      is_cleaned: false,
      upload_confirmed: true,
      created_at: '2026-10-16T10:00:00Z',
    },
    {
      id: 'vid-1',
      uploader_id: 'user-1',
      file_name: 'launch-teaser.mp4',
      public_url: 'https://media.example.com/launch-teaser.mp4',
      media_type: 'VIDEO',
      mime_type: 'video/mp4',
      file_size_bytes: 10485760,
      is_cleaned: false,
      upload_confirmed: true,
      created_at: '2026-10-16T11:00:00Z',
    },
  ];

  function createMockApi(mediaList: Media[] = sampleMedia) {
    return {
      GET: vi.fn().mockImplementation((url: string) => {
        if (url === '/api/v1/media') {
          return Promise.resolve({
            data: mediaList,
            error: undefined,
            response: new Response(JSON.stringify(mediaList), { status: 200 }),
          });
        }
        return Promise.resolve({ data: [], response: new Response('[]', { status: 200 }) });
      }),
      POST: vi.fn().mockResolvedValue({ data: {}, response: new Response('{}', { status: 201 }) }),
      PUT: vi.fn().mockResolvedValue({ data: {}, response: new Response('{}', { status: 200 }) }),
    } as unknown as Api;
  }

  test('MediaPickerModal displays visual cards, filter tabs, and toggles selection order', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    const api = createMockApi();

    render(
      <MediaPickerModal
        api={api}
        selectedIds={[]}
        initialMedia={sampleMedia}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    // Dialog title
    expect(await screen.findByRole('heading', { name: 'Thư viện Media · Chọn tệp đính kèm' })).toBeInTheDocument();

    // Visual cards for both assets
    expect(screen.getByText('hero-banner.jpg')).toBeInTheDocument();
    expect(screen.getByText('launch-teaser.mp4')).toBeInTheDocument();

    // Select first image
    const heroCard = screen.getByTitle(/hero-banner\.jpg/);
    fireEvent.click(heroCard);
    expect(heroCard).toHaveAttribute('aria-selected', 'true');
    expect(heroCard).toHaveTextContent('#1');

    // Select second video
    const teaserCard = screen.getByTitle(/launch-teaser\.mp4/);
    fireEvent.click(teaserCard);
    expect(teaserCard).toHaveAttribute('aria-selected', 'true');
    expect(teaserCard).toHaveTextContent('#2');

    // Check footer counter
    expect(screen.getByText(/Đã chọn:/)).toBeInTheDocument();

    // Apply selection
    const applyBtn = screen.getByRole('button', { name: /Áp dụng lựa chọn/ });
    fireEvent.click(applyBtn);

    expect(onConfirm).toHaveBeenCalledWith(['img-1', 'vid-1'], expect.arrayContaining([
      expect.objectContaining({ id: 'img-1' }),
      expect.objectContaining({ id: 'vid-1' }),
    ]));
    expect(onClose).toHaveBeenCalled();
  });

  test('ContentEditor opens picker modal, selects media, and displays visual cards with reorder/remove', async () => {
    const api = createMockApi();
    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(<ContentEditor api={api} onClose={onClose} onSaved={onSaved} />);

    // Initially empty media tray
    expect(screen.getByText('Chưa có media nào được đính kèm')).toBeInTheDocument();

    // Click button to open visual media picker
    const openPickerBtn = screen.getByRole('button', { name: 'Mở Thư viện chọn Media' });
    fireEvent.click(openPickerBtn);

    // MediaPickerModal is now visible
    expect(await screen.findByRole('heading', { name: 'Thư viện Media · Chọn tệp đính kèm' })).toBeInTheDocument();

    // Click to select the hero image
    const heroCard = await screen.findByTitle(/hero-banner\.jpg/);
    fireEvent.click(heroCard);

    // Click to select the teaser video
    const teaserCard = await screen.findByTitle(/launch-teaser\.mp4/);
    fireEvent.click(teaserCard);

    // Confirm selection
    const applyBtn = screen.getByRole('button', { name: /Áp dụng lựa chọn/ });
    fireEvent.click(applyBtn);

    // Picker closes, ContentEditor now shows visual cards
    expect(screen.queryByRole('heading', { name: 'Thư viện Media · Chọn tệp đính kèm' })).not.toBeInTheDocument();

    const selectedCards = document.querySelectorAll('.selected-media-card');
    expect(selectedCards.length).toBe(2);
    expect(selectedCards[0]).toHaveTextContent('#1');
    expect(selectedCards[0]).toHaveTextContent('hero-banner.jpg');
    expect(selectedCards[1]).toHaveTextContent('#2');
    expect(selectedCards[1]).toHaveTextContent('launch-teaser.mp4');

    // Reorder: click move right on item #1
    const moveRightBtn = selectedCards[0].querySelector('button[title="Di chuyển ra sau"]');
    expect(moveRightBtn).toBeInTheDocument();
    fireEvent.click(moveRightBtn!);

    // New order: launch-teaser is now #1, hero-banner is #2
    const reorderedCards = document.querySelectorAll('.selected-media-card');
    expect(reorderedCards[0]).toHaveTextContent('launch-teaser.mp4');
    expect(reorderedCards[1]).toHaveTextContent('hero-banner.jpg');

    // Remove one item
    const removeBtn = reorderedCards[0].querySelector('button[title="Gỡ bỏ khỏi bài viết"]');
    expect(removeBtn).toBeInTheDocument();
    fireEvent.click(removeBtn!);

    expect(document.querySelectorAll('.selected-media-card').length).toBe(1);
    expect(document.querySelector('.selected-media-card')).toHaveTextContent('hero-banner.jpg');
  });
});

describe('Slide Drawer Conversion for Users, ApiKeys, and MediaLibrary', () => {
  const dummyUser: User = {
    id: 'user-1',
    email: 'admin@cmmi.studio',
    role: 'ADMIN',
    is_active: true,
    created_at: '2026-10-16T00:00:00Z',
  };

  const dummyApi = {
    GET: vi.fn().mockImplementation((path: string) => {
      if (path === '/api/v1/users') {
        return Promise.resolve({ data: [dummyUser], error: null });
      }
      if (path === '/api/v1/api-keys') {
        return Promise.resolve({ data: [], error: null });
      }
      if (path === '/api/v1/media') {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: [], error: null });
    }),
    POST: vi.fn().mockResolvedValue({ data: {}, error: null }),
    PATCH: vi.fn().mockResolvedValue({ data: {}, error: null }),
    DELETE: vi.fn().mockResolvedValue({ data: {}, error: null }),
  } as unknown as Api;

  test('Users page: creation form is not visible by default and opens in Drawer on button click', async () => {
    render(<UserManager api={dummyApi} currentUser={dummyUser} />);

    // Form inputs should NOT be visible by default
    expect(screen.queryByLabelText('User email')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Initial password')).not.toBeInTheDocument();

    // Click "Invite user" button
    const inviteBtn = screen.getByRole('button', { name: /invite user/i });
    expect(inviteBtn).toBeInTheDocument();
    fireEvent.click(inviteBtn);

    // Now drawer is open with accessible dialog role and title
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invite a new perspective' })).toBeInTheDocument();
    expect(screen.getByLabelText('User email')).toBeInTheDocument();
    expect(screen.getByLabelText('Initial password')).toBeInTheDocument();

    // Close button dismisses drawer
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('ApiKeys page: connection form is not visible by default and opens in Drawer on button click', async () => {
    render(<ApiKeys api={dummyApi} isAdmin={true} />);

    // Form inputs should NOT be visible by default
    expect(screen.queryByLabelText('Key name')).not.toBeInTheDocument();

    // Click "New API key" button
    const newKeyBtn = screen.getByRole('button', { name: /new api key/i });
    expect(newKeyBtn).toBeInTheDocument();
    fireEvent.click(newKeyBtn);

    // Now drawer is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create a connection' })).toBeInTheDocument();
    expect(screen.getByLabelText('Key name')).toBeInTheDocument();

    // Close drawer
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('MediaLibrary page: upload zone is not visible by default and opens in Drawer on button click', async () => {
    render(<MediaLibrary api={dummyApi} />);

    // Upload drawer dialog should NOT be visible by default
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Upload media' })).not.toBeInTheDocument();

    // Click "Upload media" button
    const uploadBtn = screen.getByRole('button', { name: /upload media/i });
    expect(uploadBtn).toBeInTheDocument();
    fireEvent.click(uploadBtn);

    // Now upload drawer is open
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Upload media' })).toBeInTheDocument();
    expect(screen.getByText('Drop images or videos here')).toBeInTheDocument();
    expect(screen.getByLabelText('Upload media', { selector: 'input' })).toBeInTheDocument();

    // Close drawer
    const closeBtn = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(closeBtn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

