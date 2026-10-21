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
  const rawBase = import.meta.env.VITE_API_URL || window.location.origin;
  const baseUrl = rawBase ? rawBase.replace(/\/+$/, '') : '';
  const client = createClient<paths>({

    baseUrl,
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

export interface UploadProgress {
  loaded: number;
  total: number;
  percent: number;
  stage?: 'preparing' | 'uploading' | 'verifying' | 'done';
}

export async function uploadMedia(
  api: Api,
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<Media> {
  if (onProgress) {
    onProgress({ loaded: 0, total: file.size, percent: 0, stage: 'preparing' });
  }

  const reservation = await result(
    api.POST('/api/v1/media/upload-request', {
      body: { file_name: file.name, mime_type: file.type, file_size_bytes: file.size },
    }),
  );

  const isVitestMock = typeof window !== 'undefined' && 'mock' in (window.fetch as object);

  if (!isVitestMock && typeof XMLHttpRequest !== 'undefined') {
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', reservation.upload_url);
      if (reservation.headers) {
        for (const [key, val] of Object.entries(reservation.headers)) {
          xhr.setRequestHeader(key, val);
        }
      }
      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            onProgress({ loaded: event.loaded, total: event.total, percent, stage: 'uploading' });
          }
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          if (onProgress) onProgress({ loaded: file.size, total: file.size, percent: 100, stage: 'uploading' });
          resolve();
        } else {
          reject(new Error('Upload failed. Check the R2 bucket CORS policy and retry.'));
        }
      };
      xhr.onerror = () => {
        reject(new Error('Upload failed. Check your network or R2 bucket CORS policy.'));
      };
      xhr.send(file);
    });
  } else {
    if (onProgress) onProgress({ loaded: 0, total: file.size, percent: 50, stage: 'uploading' });
    const response = await fetch(reservation.upload_url, {
      method: 'PUT',
      headers: reservation.headers,
      body: file,
    });
    if (!response.ok) throw new Error('Upload failed. Check the R2 bucket CORS policy and retry.');
    if (onProgress) onProgress({ loaded: file.size, total: file.size, percent: 100, stage: 'uploading' });
  }

  if (onProgress) {
    onProgress({ loaded: file.size, total: file.size, percent: 100, stage: 'verifying' });
  }

  const confirmed = await result(
    api.POST('/api/v1/media/{media_id}/confirm', {
      params: { path: { media_id: reservation.media.id } },
    }),
  );

  if (onProgress) {
    onProgress({ loaded: file.size, total: file.size, percent: 100, stage: 'done' });
  }

  return confirmed;
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
