import { apiUrl } from './baseUrl';

export function shareUrl(token: string): string {
  return new URL(apiUrl(`/api/public/${token}`), window.location.origin).toString();
}

export async function parseError(response: Response): Promise<Error> {
  const body = await response.json().catch(() => ({ error: response.statusText }));
  return new Error(body.error ?? response.statusText);
}

function requestHeaders(options?: RequestInit): HeadersInit {
  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const method = (options?.method ?? 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    headers.set('X-Volum-Request', 'fetch');
  }
  return headers;
}

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), {
    ...options,
    headers: requestHeaders(options),
  });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new Event('volum:unauthorized'));
    }
    throw await parseError(response);
  }

  const body = await response.text();
  return (body.trim() ? JSON.parse(body) : undefined) as T;
}
