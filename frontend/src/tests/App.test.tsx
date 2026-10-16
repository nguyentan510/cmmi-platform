import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test, vi } from 'vitest';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  role: 'ADMIN',
  is_active: true,
  created_at: '2026-10-16T00:00:00Z',
};
const content = {
  id: '22222222-2222-4222-8222-222222222222',
  author_id: user.id,
  title: 'Autumn launch',
  body: 'A story worth sharing',
  status: 'DRAFT',
  scheduled_at: null,
  published_at: null,
  created_at: '2026-10-16T00:00:00Z',
  fb_post_id: '',
  tiktok_post_id: '',
  youtube_post_id: '',
  media_assets: [],
};
let requests: { url: string; method: string; body: unknown }[];
let failLogin = false;
let mediaItems: unknown[] = [];

beforeEach(() => {
  requests = [];
  failLogin = false;
  mediaItems = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init);
      const url = request.url;
      const text = await request.text();
      let body: unknown = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      requests.push({ url, method: request.method, body });
      let value: unknown = [];
      let status = 200;
      if (url.includes('/auth/login')) {
        value = failLogin
          ? { detail: 'Invalid credentials' }
          : { access_token: 'fixture-token', token_type: 'bearer' };
        status = failLogin ? 401 : 200;
      } else if (url.includes('/auth/me')) value = user;
      else if (url.includes('/api-keys') && request.method === 'POST') {
        value = {
          id: 'key-id',
          user_id: user.id,
          name: 'Publishing bot',
          scopes: ['contents:read'],
          key_prefix: 'cmmi_live_preview',
          key: 'cmmi_live_show-only-once',
          expires_at: null,
          last_used_at: null,
          is_active: true,
        };
        status = 201;
      } else if (url.includes('/contents') && request.method === 'POST') {
        value = { ...content, ...(body as object), id: 'new-id' };
        status = 201;
      } else if (url.includes('/contents')) value = [content];
      else if (url.includes('/media/upload-request')) {
        value = {
          media: {
            id: 'media-1',
            uploader_id: user.id,
            file_name: 'frame.png',
            public_url: '',
            media_type: 'IMAGE',
            mime_type: 'image/png',
            file_size_bytes: 3,
            is_cleaned: false,
            upload_confirmed: false,
            created_at: '2026-10-16T00:00:00Z',
          },
          upload_url: 'https://r2.example.test/upload',
          expires_in: 900,
          headers: { 'Content-Type': 'image/png' },
        };
        status = 201;
      } else if (url.includes('/media/media-1/confirm')) {
        value = {
          id: 'media-1',
          uploader_id: user.id,
          file_name: 'frame.png',
          public_url: 'https://cdn.example.test/frame.png',
          media_type: 'IMAGE',
          mime_type: 'image/png',
          file_size_bytes: 3,
          is_cleaned: false,
          upload_confirmed: true,
          created_at: '2026-10-16T00:00:00Z',
        };
        mediaItems = [value];
      } else if (url.includes('/media')) value = mediaItems;
      else if (url.includes('/settings/cleanup/trigger'))
        value = { deleted_count: 2, failed_count: 0, skipped: false };
      else if (url.includes('/settings/cleanup'))
        value = {
          auto_clean_media: true,
          retention_days: 7,
          cron_expression: '0 2 * * *',
          updated_at: '2026-10-16T00:00:00Z',
          last_run_at: null,
          last_deleted_count: 0,
          active_storage_bytes: 20,
          active_media_count: 1,
        };
      else if (url.includes('/users')) {
        value =
          request.method === 'POST'
            ? { ...user, email: 'creator@example.com', role: 'CREATOR' }
            : [user];
        status = request.method === 'POST' ? 201 : 200;
      }
      return new Response(JSON.stringify(value), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

async function renderApp() {
  let App;
  try {
    const modulePath = '../App.tsx';
    App = (await import(/* @vite-ignore */ modulePath)).default;
  } catch {
    /* missing application is the initial RED */
  }
  expect(App, 'The CMMI admin application must exist').toBeDefined();
  render(<App />);
}

async function signIn() {
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Email'), 'admin@example.com');
  await u.type(screen.getByLabelText('Password'), 'StrongPassword123!');
  await u.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: 'Content workspace' });
  return u;
}

test('login opens owner content workspace and signs out', async () => {
  await renderApp();
  const u = await signIn();
  expect(await screen.findByText('Autumn launch')).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'Sign out' }));
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});

test('login displays authentication failure without opening workspace', async () => {
  failLogin = true;
  await renderApp();
  const u = userEvent.setup();
  await u.type(screen.getByLabelText('Email'), 'admin@example.com');
  await u.type(screen.getByLabelText('Password'), 'WrongPassword');
  await u.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials');
  expect(screen.queryByRole('heading', { name: 'Content workspace' })).not.toBeInTheDocument();
});

test('content creation sends empty channel defaults and real entered text', async () => {
  await renderApp();
  const u = await signIn();
  await u.click(screen.getByRole('button', { name: 'New content' }));
  await u.type(screen.getByLabelText('Title'), 'New campaign');
  await u.type(screen.getByLabelText('Body'), 'The next chapter');
  await u.click(screen.getByRole('button', { name: 'Save content' }));
  await waitFor(() =>
    expect(
      requests.find((r) => r.url.includes('/contents') && r.method === 'POST')?.body,
    ).toMatchObject({
      title: 'New campaign',
      body: 'The next chapter',
      fb_post_id: '',
      tiktok_post_id: '',
      youtube_post_id: '',
      media_ids: [],
    }),
  );
});

test('API key secret is visible once and disappears when dismissed', async () => {
  await renderApp();
  const u = await signIn();
  await u.click(screen.getByRole('button', { name: 'API keys' }));
  await screen.findByRole('heading', { name: 'API keys' });
  await u.type(screen.getByLabelText('Key name'), 'Publishing bot');
  await u.click(screen.getByRole('button', { name: 'Create key' }));
  expect(await screen.findByText('cmmi_live_show-only-once')).toBeInTheDocument();
  await u.click(screen.getByRole('button', { name: 'I saved this key' }));
  expect(screen.queryByText('cmmi_live_show-only-once')).not.toBeInTheDocument();
  expect(localStorage.length).toBe(0);
});

test('media uploads directly then confirms before showing a preview', async () => {
  await renderApp();
  const u = await signIn();
  await u.click(screen.getByRole('button', { name: 'Media library' }));
  await u.upload(
    screen.getByLabelText('Upload media'),
    new File(['abc'], 'frame.png', { type: 'image/png' }),
  );
  expect(await screen.findByAltText('frame.png')).toBeInTheDocument();
  const upload = requests.findIndex((r) => r.url.includes('r2.example.test') && r.method === 'PUT');
  const confirm = requests.findIndex((r) => r.url.includes('/confirm'));
  expect(upload).toBeGreaterThan(-1);
  expect(confirm).toBeGreaterThan(upload);
});

test('admin can save retention and see cleanup results', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  await renderApp();
  const u = await signIn();
  await u.click(screen.getByRole('button', { name: 'Settings' }));
  const retention = await screen.findByLabelText('Retention days');
  await u.clear(retention);
  await u.type(retention, '14');
  await u.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() =>
    expect(
      requests.find((r) => r.url.includes('/settings/cleanup') && r.method === 'PUT')?.body,
    ).toMatchObject({ retention_days: 14 }),
  );
  await u.click(screen.getByRole('button', { name: 'Run cleanup now' }));
  expect(await screen.findByRole('status')).toHaveTextContent('2 deleted');
});

test('admin creates a creator through user management', async () => {
  await renderApp();
  const u = await signIn();
  await u.click(screen.getByRole('button', { name: 'Users' }));
  await u.type(await screen.findByLabelText('User email'), 'creator@example.com');
  await u.type(screen.getByLabelText('Initial password'), 'CreatorPassword123!');
  await u.click(screen.getByRole('button', { name: 'Create user' }));
  await waitFor(() =>
    expect(
      requests.find((r) => r.url.includes('/users') && r.method === 'POST')?.body,
    ).toMatchObject({ email: 'creator@example.com', role: 'CREATOR' }),
  );
});

test('workspace help link opens the guide without losing the signed-in session', async () => {
  await renderApp();
  const u = await signIn();
  await u.click(screen.getByRole('link', { name: 'Meet your workspace' }));
  expect(await screen.findByRole('heading', { name: 'Help & docs' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
});
