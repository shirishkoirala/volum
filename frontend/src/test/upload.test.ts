import { describe, expect, it } from 'vitest';
import { unsupportedUploadReason } from '../utils/upload';

describe('upload utilities', () => {
  it('rejects app bundles before upload starts', () => {
    const file = new File([], 'Nextcloud.app');

    expect(unsupportedUploadReason(file)).toBe('Folder and app-bundle uploads are not supported yet');
  });

  it('rejects app bundles case-insensitively', () => {
    const file = new File([], 'Example.APP');

    expect(unsupportedUploadReason(file)).toBe('Folder and app-bundle uploads are not supported yet');
  });

  it('allows ordinary zero-byte files', () => {
    const file = new File([], 'empty.txt');

    expect(unsupportedUploadReason(file)).toBeNull();
  });
});
