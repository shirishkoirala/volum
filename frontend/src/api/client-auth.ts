import { request } from './client-base';

export type Session = {
  authEnabled: boolean;
  authenticated: boolean;
  setupRequired?: boolean;
  userId?: string;
  username?: string;
  role?: 'admin' | 'readonly' | '';
  hasAvatar?: boolean;
  avatarVersion?: number;
};

export type AvatarState = {
  hasAvatar: boolean;
  avatarVersion: number;
};

export type UserInfo = {
  id: string;
  username: string;
  role: 'admin' | 'readonly';
};

import { apiUrl } from './baseUrl';

export function getSession() {
  return request<Session>('/api/session');
}

export function profileAvatarUrl(version?: number): string {
  const suffix = version ? `?v=${version}` : '';
  return apiUrl(`/api/profile/avatar${suffix}`);
}

export async function uploadProfileAvatar(file: File): Promise<AvatarState> {
  const form = new FormData();
  form.append('avatar', file);
  const response = await fetch(apiUrl('/api/profile/avatar'), {
    method: 'PUT',
    headers: { 'X-Volum-Request': 'fetch' },
    body: form,
  });
  if (!response.ok)
    throw new Error(
      (await response.json().catch(() => ({ error: response.statusText }))).error ??
        response.statusText,
    );
  return response.json() as Promise<AvatarState>;
}

export function deleteProfileAvatar(): Promise<AvatarState> {
  return request<AvatarState>('/api/profile/avatar', { method: 'DELETE' });
}

export function login(username: string, password: string, rememberMe = false) {
  return request<Session>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, rememberMe }),
  });
}

export function logout() {
  return request<Session>('/api/logout', {
    method: 'POST',
  });
}

export function setup(username: string, password: string, bootstrapToken: string) {
  return request<Session>('/api/setup', {
    method: 'POST',
    headers: { 'X-Bootstrap-Token': bootstrapToken },
    body: JSON.stringify({ username, password }),
  });
}

export function listUsers() {
  return request<UserInfo[]>('/api/users');
}

export function createUser(username: string, password: string, role: 'admin' | 'readonly') {
  return request('/api/users', {
    method: 'POST',
    body: JSON.stringify({ username, password, role }),
  });
}

export function deleteUser(userId: string) {
  return request(`/api/users/${userId}`, {
    method: 'DELETE',
  });
}

export function changePassword(userId: string, password: string) {
  return request(`/api/users/${userId}/password`, {
    method: 'PATCH',
    body: JSON.stringify({ newPassword: password }),
  });
}

export function changeRole(userId: string, role: 'admin' | 'readonly') {
  return request(`/api/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export function revokeUserSessions(userId: string) {
  return request(`/api/users/${userId}/revoke-sessions`, {
    method: 'POST',
  });
}
