import { request, requestVoid } from './client-base';

export type Share = {
  id: string;
  path: string;
  token: string;
  expiresAt?: string;
  maxDownloads?: number;
  downloadCount: number;
  enabled: boolean;
  createdBy: string;
  createdAt: string;
};

export type CreateShareRequest = {
  path: string;
  password?: string;
  expiresAt?: string;
  maxDownloads?: number;
};

export function createShare(req: CreateShareRequest) {
  return request<Share>('/api/shares', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export function getShares() {
  return request<{ shares: Share[] }>('/api/shares');
}

export function deleteShare(id: string) {
  return requestVoid(`/api/shares/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
