import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiRequest, setAccessTokenProvider } from '../../src/frontend/src/lib/api/client';

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessTokenProvider(null);
});

describe('shared REST API client', () => {
  it('encodes query parameters and reads JSON', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const response = await api.get<{ results: unknown[] }>('songs/', { query: { q: 'jazz & blues' } });
    expect(response.results).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/songs/?q=jazz+%26+blues');
  });

  it('serializes JSON and adds an optional bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    setAccessTokenProvider(() => 'test-token');
    await api.post('songs/', { title: 'A song' });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = new Headers(init.headers);
    expect(init.body).toBe(JSON.stringify({ title: 'A song' }));
    expect(headers.get('Authorization')).toBe('Bearer test-token');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('keeps multipart form uploads free of a forced JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.set('title', 'Demo');
    await apiRequest('uploads/', { method: 'POST', body: form });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('reports Django REST error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Not authorized' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    ));
    await expect(api.get('private/')).rejects.toMatchObject({
      name: 'ApiError', status: 403, message: 'Not authorized',
    } satisfies Partial<ApiError>);
  });
});
