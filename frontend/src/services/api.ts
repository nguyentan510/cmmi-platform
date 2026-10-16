import createClient from 'openapi-fetch';
import type { components, paths } from '../types/api';

export type Content = components['schemas']['ContentRead'];
export type ContentInput = components['schemas']['ContentCreate'];
export type Media = components['schemas']['MediaRead'];
export type User = components['schemas']['UserRead'];
export type Key = components['schemas']['KeyRead'];
export type Settings = components['schemas']['SettingRead'];
export type SettingInput = components['schemas']['SettingUpdate'];
export type Status = components['schemas']['ContentStatus'];
export type Api = ReturnType<typeof makeApi>;

export function makeApi(token?: string) {
  const client = createClient<paths>({
    baseUrl: window.location.origin,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  client.use({
    onResponse({ response }) {
      if (response.status === 401 && token) window.dispatchEvent(new Event('cmmi:unauthorized'));
    },
  });
  return client;
}

export function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (value && typeof value === 'object' && 'detail' in value) {
    const detail = value.detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail))
      return detail
        .map(
          (item: { loc?: string[]; msg?: string }) =>
            `${item.loc?.slice(1).join('.') ?? ''}: ${item.msg ?? 'Invalid value'}`,
        )
        .join('; ');
  }
  return 'The request failed. Please try again.';
}

export async function result<T>(
  request: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await request;
  if (!response.ok) throw new Error(errorMessage(error));
  return data as T;
}

export async function uploadMedia(api: Api, file: File): Promise<Media> {
  const reservation = await result(
    api.POST('/api/v1/media/upload-request', {
      body: { file_name: file.name, mime_type: file.type, file_size_bytes: file.size },
    }),
  );
  const response = await fetch(reservation.upload_url, {
    method: 'PUT',
    headers: reservation.headers,
    body: file,
  });
  if (!response.ok) throw new Error('Upload failed. Check the R2 bucket CORS policy and retry.');
  return result(
    api.POST('/api/v1/media/{media_id}/confirm', {
      params: { path: { media_id: reservation.media.id } },
    }),
  );
}

export const formatBytes = (bytes: number) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(2)} GB`
    : bytes >= 1e6
      ? `${(bytes / 1e6).toFixed(1)} MB`
      : `${(bytes / 1e3).toFixed(1)} KB`;
export const dateText = (value?: string | null) =>
  value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export function localDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
