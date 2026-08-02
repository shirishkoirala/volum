import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDevices } from '../api/client-files';
import { DrivesView } from '../pages/DrivesView';

vi.mock('../api/client-files', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client-files')>();
  return { ...actual, getDevices: vi.fn() };
});

describe('DrivesView states', () => {
  beforeEach(() => {
    vi.mocked(getDevices).mockReset();
  });

  it('does not show the empty state while drives are loading', async () => {
    let finish!: (value: { devices: [] }) => void;
    vi.mocked(getDevices).mockReturnValue(new Promise((resolve) => (finish = resolve)));

    render(<DrivesView />);
    expect(screen.queryByText('No drives found')).not.toBeInTheDocument();

    await act(async () => finish({ devices: [] }));
    expect(await screen.findByText('No drives found')).toBeInTheDocument();
  });

  it('shows an error without also showing the empty state', async () => {
    vi.mocked(getDevices).mockRejectedValue(new Error('Drives unavailable'));

    render(<DrivesView />);

    expect(await screen.findByText('Drives unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No drives found')).not.toBeInTheDocument();
  });
});
