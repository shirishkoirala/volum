import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DiskUsageAnalyzer } from '../components/overlay/DiskUsageAnalyzer';
import { analyzeDiskUsage } from '../api/client';
import type { DiskUsageNode } from '../api/client';

vi.mock('../api/client', async (importOriginal) => ({
  ...(await importOriginal()),
  analyzeDiskUsage: vi.fn(),
}));

const mockTree: DiskUsageNode = {
  path: '/storage',
  name: 'storage',
  size: 1024000,
  isDir: true,
  percentage: 100,
  children: [
    {
      path: '/storage/docs',
      name: 'docs',
      size: 600000,
      isDir: true,
      percentage: 58.6,
      children: [
        {
          path: '/storage/docs/file.txt',
          name: 'file.txt',
          size: 500000,
          isDir: false,
          percentage: 48.8,
          children: [],
        },
        {
          path: '/storage/docs/notes.md',
          name: 'notes.md',
          size: 100000,
          isDir: false,
          percentage: 9.8,
          children: [],
        },
      ],
    },
    {
      path: '/storage/photos',
      name: 'photos',
      size: 424000,
      isDir: true,
      percentage: 41.4,
      children: [],
    },
  ],
};

describe('DiskUsageAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(analyzeDiskUsage).mockReturnValue(new Promise(() => {}));
    render(<DiskUsageAnalyzer path="/storage" onClose={() => {}} />);
    expect(screen.getByText('Scanning directory tree...')).toBeInTheDocument();
  });

  it('renders tree after loading', async () => {
    vi.mocked(analyzeDiskUsage).mockResolvedValue(mockTree);
    render(<DiskUsageAnalyzer path="/storage" onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('/storage')).toBeInTheDocument();
    });
    expect(screen.getByText('docs')).toBeInTheDocument();
    expect(screen.getByText('photos')).toBeInTheDocument();
  });

  it('shows file sizes and percentages', async () => {
    vi.mocked(analyzeDiskUsage).mockResolvedValue(mockTree);
    render(<DiskUsageAnalyzer path="/storage" onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('1000.0 KB')).toBeInTheDocument();
    });
  });

  it('renders error state on API failure', async () => {
    vi.mocked(analyzeDiskUsage).mockRejectedValue(new Error('Network error'));
    render(<DiskUsageAnalyzer path="/storage" onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('renders close button with aria-label', () => {
    vi.mocked(analyzeDiskUsage).mockReturnValue(new Promise(() => {}));
    render(<DiskUsageAnalyzer path="/storage" onClose={() => {}} />);
    expect(screen.getByLabelText('Close')).toBeInTheDocument();
  });
});
