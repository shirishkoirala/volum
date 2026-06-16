import { describe, it, expect } from 'vitest';
import { formatBytes, formatUptime, formatGridDate, formatDeviceUsage, formatDuration } from '../utils/format';
import type { BlockDevice } from '../api/client';

describe('formatBytes', () => {
  it('returns 0 B for null', () => {
    expect(formatBytes(null as unknown as number)).toBe('0 B');
  });

  it('returns 0 B for NaN', () => {
    expect(formatBytes(NaN)).toBe('0 B');
  });

  it('returns 0 B for zero', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats KB', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formats MB', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });

  it('formats GB', () => {
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe('3.5 GB');
  });

  it('formats TB', () => {
    expect(formatBytes(2 * 1024 * 1024 * 1024 * 1024)).toBe('2.0 TB');
  });

  it('clamps at TB for huge values', () => {
    expect(formatBytes(9999 * 1024 * 1024 * 1024 * 1024)).toBe('9999.0 TB');
  });
});

describe('formatUptime', () => {
  it('returns < 1m for 0 seconds', () => {
    expect(formatUptime(0)).toBe('< 1m');
  });

  it('returns minutes only', () => {
    expect(formatUptime(300)).toBe('5m');
  });

  it('returns hours and minutes', () => {
    expect(formatUptime(3660)).toBe('1h 1m');
  });

  it('returns days, hours, minutes', () => {
    expect(formatUptime(90000)).toBe('1d 1h');
  });

  it('returns multiple days', () => {
    expect(formatUptime(200000)).toBe('2d 7h 33m');
  });
});

describe('formatDuration', () => {
  it('returns < 1s for zero seconds', () => {
    expect(formatDuration(0)).toBe('< 1s');
  });

  it('returns empty string for negative values', () => {
    expect(formatDuration(-1)).toBe('');
  });

  it('returns mixed hour, minute, second labels', () => {
    expect(formatDuration(3661)).toBe('1h 1m 1s');
  });
});

describe('formatGridDate', () => {
  it('returns empty string for invalid date', () => {
    expect(formatGridDate('not-a-date')).toBe('');
  });

  it('formats a valid ISO date', () => {
    const result = formatGridDate('2026-06-10T14:30:00Z');
    expect(result).toMatch(/^\d{2}\/\d{2}/);
  });
});

describe('formatDeviceUsage', () => {
  const basePart: BlockDevice = {
    name: 'sda1',
    size: '100G',
    type: 'disk',
    rotational: false,
    mountPoint: '/mnt/data',
    totalBytes: 1_000_000_000,
    usedBytes: 400_000_000,
    freeBytes: 600_000_000,
    fsType: 'ext4',
  };

  it('shows usage when totalBytes > 0', () => {
    const result = formatDeviceUsage(basePart);
    expect(result).toContain('used');
    expect(result).toContain('ext4');
  });

  it('shows usage with different fsType', () => {
    const result = formatDeviceUsage({ ...basePart, fsType: 'ntfs' });
    expect(result).toContain('ntfs');
  });

  it('shows usage without fsType when undefined', () => {
    const result = formatDeviceUsage({ ...basePart, fsType: undefined });
    expect(result).not.toContain('·');
  });

  it('returns "Usage unavailable" when totalBytes is 0 but mountPoint exists', () => {
    const result = formatDeviceUsage({ ...basePart, totalBytes: 0 });
    expect(result).toBe('Usage unavailable');
  });

  it('returns "Not mounted" when no mountPoint and no totalBytes', () => {
    const result = formatDeviceUsage({ ...basePart, mountPoint: undefined, totalBytes: 0 });
    expect(result).toBe('Not mounted');
  });
});
