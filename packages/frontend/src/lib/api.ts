/**
 * Typed fetch wrapper for SDLC Hub REST API.
 * Reads JWT from localStorage, attaches it as Bearer token,
 * and throws ApiError with status code on non-2xx responses.
 */

const BASE = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  return localStorage.getItem('sdlc_token');
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string | undefined>,
): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) url.searchParams.set(k, v);
    });
  }

  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const err = (await res.json()) as { message?: string };
      message = err.message ?? message;
    } catch { /* ignore */ }
    throw new ApiError(res.status, message);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | undefined>) =>
    request<T>('GET', path, undefined, params),
  post: <T>(path: string, body?: unknown, params?: Record<string, string | undefined>) =>
    request<T>('POST', path, body, params),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
