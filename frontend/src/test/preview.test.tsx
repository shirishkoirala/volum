import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileEntry } from '../api/client';
import {
  MAX_IMAGE_PREVIEW_BYTES,
  MAX_TEXT_PREVIEW_BYTES,
  MAX_THUMBNAIL_BYTES,
  canThumbnail,
  previewBlockedReason,
} from '../utils/preview';
import { PreviewContent } from '../components/overlay/PreviewModal';

function entry(overrides: Partial<FileEntry>): FileEntry {
  return {
    name: 'file.txt',
    path: '/storage/file.txt',
    type: 'file',
    size: 10,
    modifiedAt: '2026-06-14T00:00:00Z',
    permissions: '-rw-r--r--',
    owner: '1000',
    group: '1000',
    hidden: false,
    ...overrides,
  };
}

describe('preview policy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('allows thumbnails only for reasonably sized non-gif images', () => {
    expect(canThumbnail(entry({ name: 'photo.jpg', size: MAX_THUMBNAIL_BYTES }))).toBe(true);
    expect(canThumbnail(entry({ name: 'photo.jpg', size: MAX_THUMBNAIL_BYTES + 1 }))).toBe(false);
    expect(canThumbnail(entry({ name: 'animated.gif', size: 10 }))).toBe(false);
    expect(canThumbnail(entry({ name: 'notes.txt', size: 10 }))).toBe(false);
  });

  it('blocks expensive inline previews', () => {
    expect(previewBlockedReason(entry({ name: 'large.txt', size: MAX_TEXT_PREVIEW_BYTES + 1 }))).toContain('Text preview');
    expect(previewBlockedReason(entry({ name: 'large.jpg', size: MAX_IMAGE_PREVIEW_BYTES + 1 }))).toContain('Image preview');
    expect(previewBlockedReason(entry({ name: 'small.jpg', size: MAX_IMAGE_PREVIEW_BYTES }))).toBeNull();
  });

  it('does not fetch blocked text previews', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    render(<PreviewContent entry={entry({ name: 'large.log', size: MAX_TEXT_PREVIEW_BYTES + 1 })} />);

    expect(screen.getByText('Text preview is limited to 1 MB to keep the browser responsive.')).toBeInTheDocument();
    expect(screen.getByText('Download instead')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('aborts text preview fetches when the preview closes', () => {
    let signal: AbortSignal | undefined;
    const fetchSpy = vi.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { unmount } = render(<PreviewContent entry={entry({ name: 'notes.txt' })} />);

    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(signal?.aborted).toBe(false);

    unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('keeps image previews mounted in strict mode', () => {
    render(
      <StrictMode>
        <PreviewContent entry={entry({ name: 'photo.jpg', path: '/storage/photo.jpg' })} />
      </StrictMode>,
    );

    expect(screen.getByAltText('photo.jpg')).toHaveAttribute('src', '/api/files/raw?path=%2Fstorage%2Fphoto.jpg');
  });

  it('unloads media previews when the preview closes', () => {
    const { unmount } = render(<PreviewContent entry={entry({ name: 'clip.mp4', path: '/storage/clip.mp4' })} />);

    unmount();

    expect(screen.queryByRole('video')).not.toBeInTheDocument();
  });

  it('renders next and previous preview controls when provided', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const onNext = vi.fn();

    render(
      <PreviewContent
        entry={entry({ name: 'photo.jpg' })}
        onPrevious={onPrevious}
        onNext={onNext}
        previousDisabled
        nextDisabled={false}
        positionLabel="1 of 2"
      />,
    );

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
    expect(screen.getByTitle('Previous file')).toBeDisabled();

    await user.click(screen.getByTitle('Next file'));
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).not.toHaveBeenCalled();
  });

  it('copies the preview file path', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<PreviewContent entry={entry({ name: 'photo.jpg', path: '/storage/photos/photo.jpg' })} />);

    await user.click(screen.getByTitle('Copy path'));

    expect(writeText).toHaveBeenCalledWith('/storage/photos/photo.jpg');
    expect(await screen.findByTitle('Path copied')).toBeInTheDocument();
  });

  it('calls the share action when provided', async () => {
    const user = userEvent.setup();
    const onShare = vi.fn();

    render(<PreviewContent entry={entry({ name: 'photo.jpg' })} onShare={onShare} />);

    await user.click(screen.getByTitle('Share'));
    expect(onShare).toHaveBeenCalledOnce();
  });
});
