import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopView } from '../pages/DesktopView';

const defaultProps = {
  trashEntries: [],
  jobs: [],
  favorites: [],
  onNavigateTo: vi.fn(),
  onNavigateToTrash: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenJobs: vi.fn(),
  onOpenFiles: vi.fn(),
  onOpenStorageAnalyzer: vi.fn(),
  onOpenService: vi.fn(),
  onShowMyPC: vi.fn(),
  onItemContextMenu: vi.fn(),
};

describe('DesktopView', () => {
  it('renders service health status on service shortcuts with a health URL', () => {
    render(
      <DesktopView
        {...defaultProps}
        services={[
          {
            id: 'svc-1',
            name: 'Jellyfin',
            url: 'https://jellyfin.example.com',
            iconUrl: 'https://example.com/jellyfin.svg',
            healthUrl: 'https://jellyfin.example.com/health',
          },
        ]}
        serviceHealth={{
          'svc-1': {
            serviceId: 'svc-1',
            status: 'healthy',
            checkedAt: '2026-06-14T00:00:00Z',
            statusCode: 204,
          },
        }}
      />,
    );

    expect(screen.getByLabelText('Jellyfin health: healthy')).toBeInTheDocument();
  });

  it('does not render service health status without a health URL', () => {
    render(
      <DesktopView
        {...defaultProps}
        services={[
          {
            id: 'svc-1',
            name: 'Jellyfin',
            url: 'https://jellyfin.example.com',
          },
        ]}
        serviceHealth={{}}
      />,
    );

    expect(screen.queryByLabelText('Jellyfin health: checking')).not.toBeInTheDocument();
  });
});
