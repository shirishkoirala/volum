import { beforeEach, describe, expect, it } from 'vitest';
import { loadLastUser, saveLastUser } from '../utils/lastUser';

describe('last user profile', () => {
  beforeEach(() => localStorage.clear());

  it('returns a stored username and avatar', () => {
    localStorage.setItem(
      'volum_last_user',
      JSON.stringify({
        username: 'admin',
        avatarDataUrl: 'data:image/png;base64,abc',
      }),
    );

    expect(loadLastUser()).toEqual({
      username: 'admin',
      avatarDataUrl: 'data:image/png;base64,abc',
    });
  });

  it('ignores malformed stored data', () => {
    localStorage.setItem('volum_last_user', '{bad json');
    expect(loadLastUser()).toBeNull();
  });

  it('stores only authenticated users', async () => {
    await saveLastUser({ authEnabled: true, authenticated: false, username: 'guest' });
    expect(loadLastUser()).toBeNull();

    await saveLastUser({ authEnabled: true, authenticated: true, username: 'admin' });
    expect(loadLastUser()).toEqual({ username: 'admin', avatarDataUrl: undefined });
  });
});
