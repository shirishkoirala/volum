import { request, requestVoid } from './client-base';

export type ServiceInfo = {
  id: string;
  name: string;
  url: string;
  iconUrl: string;
  healthUrl: string;
  description?: string;
  openMode?: 'embed' | 'tab';
  position: number;
  lastHealthStatus?: string;
  lastHealthCheckedAt?: string;
  lastHealthStatusCode?: number;
  lastHealthError?: string;
};

export type ServiceHealthInfo = {
  serviceId: string;
  status: 'healthy' | 'unhealthy';
  checkedAt: string;
  statusCode?: number;
  error?: string;
};

export function listFavorites() {
  return request<string[]>('/api/favorites');
}

export function addFavorite(path: string) {
  return requestVoid('/api/favorites', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export function removeFavorite(path: string) {
  return requestVoid('/api/favorites', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  });
}

export function reorderFavorites(paths: string[]) {
  return requestVoid('/api/favorites/reorder', {
    method: 'PUT',
    body: JSON.stringify({ paths }),
  });
}

export function listServices() {
  return request<ServiceInfo[]>('/api/services');
}

export function listServiceHealth() {
  return request<Record<string, ServiceHealthInfo>>('/api/services/health');
}

function serviceBody(
  name: string,
  url: string,
  iconUrl?: string,
  healthUrl?: string,
  description?: string,
  openMode?: string,
) {
  return { name, url, iconUrl, healthUrl, description, openMode };
}

export function createService(
  name: string,
  url: string,
  iconUrl?: string,
  healthUrl?: string,
  description?: string,
  openMode?: string,
) {
  return request<ServiceInfo>('/api/services', {
    method: 'POST',
    body: JSON.stringify(serviceBody(name, url, iconUrl, healthUrl, description, openMode)),
  });
}

export function updateService(
  id: string,
  name: string,
  url: string,
  iconUrl?: string,
  healthUrl?: string,
  description?: string,
  openMode?: string,
) {
  return request<ServiceInfo>(`/api/services/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(serviceBody(name, url, iconUrl, healthUrl, description, openMode)),
  });
}

export function deleteService(id: string) {
  return requestVoid(`/api/services/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function reorderServices(ids: string[]) {
  return requestVoid('/api/services/reorder', {
    method: 'PUT',
    body: JSON.stringify({ ids }),
  });
}

export function dbVacuum() {
  return request<{ status: string }>('/api/db/vacuum', { method: 'POST' });
}

export function pruneTable(
  table: 'jobs' | 'audit-logs',
  olderThan?: string,
): Promise<{ removed: number }> {
  const params = olderThan ? `?olderThan=${encodeURIComponent(olderThan)}` : '';
  return request<{ removed: number }>(`/api/db/prune-${table}${params}`, { method: 'POST' });
}
