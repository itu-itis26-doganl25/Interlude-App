/**
 * Shared Django REST client — feature owners supply their endpoint paths.
 * No API paths or authentication strategy are assumed by the foundation.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | null | undefined;
export type ApiQuery = Record<string, QueryValue>;

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  query?: ApiQuery;
  /** JSON payload (serialized and marked application/json automatically). */
  data?: unknown;
  /** Raw body, useful for multipart FormData uploads. Do not use with data. */
  body?: BodyInit | null;
}

type TokenProvider = () => string | null | Promise<string | null>;
let tokenProvider: TokenProvider | null = null;

/** Auth owner calls this after deciding how tokens are managed in memory. */
export function setAccessTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${name}=`;
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function apiUrl(path: string, query?: ApiQuery): string {
  const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
  const endpoint = path.replace(/^\/+/, '');
  const url = `${base}/${endpoint}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== null && value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${url}${url.includes('?') ? '&' : '?'}${search}` : url;
}

/**
 * Defaults to same-origin cookies, including the Vite /api proxy in development.
 * For cross-origin cookie auth, explicitly configure CORS + CSRF on Django and
 * pass credentials: 'include' through options.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { query, data, body, headers: optionHeaders, ...init } = options;
  if (data !== undefined && body !== undefined) {
    throw new Error('Pass either data or body, not both');
  }

  const headers = new Headers(optionHeaders);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  let requestBody: BodyInit | null | undefined = body;
  if (data !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(data);
  }

  const method = (init.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const csrf = readCookie('csrftoken');
    if (csrf && !headers.has('X-CSRFToken')) headers.set('X-CSRFToken', csrf);
  }
  if (!headers.has('Authorization') && tokenProvider) {
    const token = await tokenProvider();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(apiUrl(path, query), {
    ...init,
    method,
    credentials: init.credentials ?? 'same-origin',
    headers,
    body: requestBody,
  });

  const contentType = response.headers.get('content-type') ?? '';
  let payload: unknown;
  if (response.status !== 204 && response.status !== 205) {
    if (contentType.includes('application/json')) {
      try { payload = await response.json(); } catch { payload = undefined; }
    } else {
      payload = await response.text();
    }
  }

  if (!response.ok) {
    const djangoMessage = payload && typeof payload === 'object' && 'detail' in payload
      ? String((payload as { detail: unknown }).detail)
      : null;
    throw new ApiError(response.status, djangoMessage || `Request failed (${response.status})`, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, options: ApiRequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, data?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'POST', data }),
  put: <T>(path: string, data?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'PUT', data }),
  patch: <T>(path: string, data?: unknown, options: ApiRequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', data }),
  delete: <T>(path: string, options: ApiRequestOptions = {}) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
