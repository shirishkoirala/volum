import { profileAvatarUrl, type Session } from '../api/client';

const LAST_USER_KEY = 'volum_last_user';

export type LastUser = {
  username: string;
  avatarDataUrl?: string;
};

export function loadLastUser(): LastUser | null {
  try {
    const stored = localStorage.getItem(LAST_USER_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<LastUser>;
    if (typeof parsed.username !== 'string' || !parsed.username) return null;
    return {
      username: parsed.username,
      avatarDataUrl: typeof parsed.avatarDataUrl === 'string' ? parsed.avatarDataUrl : undefined,
    };
  } catch {
    return null;
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const size = 128;
      const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not prepare profile image'));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read profile image'));
    };
    image.src = objectUrl;
  });
}

export async function saveLastUser(session: Session): Promise<void> {
  if (!session.authenticated || !session.username) return;

  const lastUser: LastUser = { username: session.username };
  if (session.hasAvatar) {
    try {
      const response = await fetch(profileAvatarUrl(session.avatarVersion));
      if (response.ok) lastUser.avatarDataUrl = await blobToDataUrl(await response.blob());
    } catch {
      const previous = loadLastUser();
      if (previous?.username === session.username) lastUser.avatarDataUrl = previous.avatarDataUrl;
    }
  }

  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify(lastUser));
  } catch {
    // A cached avatar is optional and must never interfere with authentication.
  }
}
