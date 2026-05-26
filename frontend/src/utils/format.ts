/**
 * Shared formatting utilities for bytes, dates, paths, and device usage.
 * All formatting functions live here so callers don't duplicate them.
 */

import type { BlockDevice } from '../api/client';

/**
 * Format a byte count as a human-readable string (e.g. "1.5 GB").
 * Handles null, NaN, and zero without exploding.
 */
export function formatBytes(value: number): string {
  if (value == null || Number.isNaN(value) || value === 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

/**
 * Format server uptime in seconds to a short label like "2d 5h 30m".
 */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '< 1m';
}

/**
 * Format an ISO date string for display in file grid views.
 */
export function formatGridDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Produce a human-readable usage summary for a block device partition.
 */
export function formatDeviceUsage(part: BlockDevice): string {
  if (part.totalBytes != null && part.totalBytes > 0) {
    const fsType = part.fsType ? ` · ${part.fsType}` : '';
    return `${formatBytes(part.usedBytes!)} used of ${formatBytes(part.totalBytes)} | ${formatBytes(part.freeBytes!)} free${fsType}`;
  }
  if (part.mountPoint) {
    return 'Usage unavailable';
  }
  return 'Not mounted';
}
