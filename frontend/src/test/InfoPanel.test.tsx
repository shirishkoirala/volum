import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InfoPanel } from '../components/overlay/InfoPanel';
import type { FileEntry } from '../api/client';

const mockEntry: FileEntry = {
  name: 'test.txt',
  path: '/storage/test.txt',
  type: 'file',
  size: 1024,
  modifiedAt: '2026-05-22T10:00:00Z',
  permissions: '-rw-r--r--',
  owner: '1000',
  group: '1000',
  hidden: false,
};

const mockDir: FileEntry = {
  name: 'Documents',
  path: '/storage/Documents',
  type: 'directory',
  size: 4096,
  modifiedAt: '2026-05-22T10:00:00Z',
  permissions: '-rwxr-xr-x',
  owner: '1000',
  group: '1000',
  hidden: false,
};

describe('InfoPanel', () => {
  it('renders file name and type', () => {
    render(<InfoPanel entry={mockEntry} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('test.txt')).toBeInTheDocument();
    expect(screen.getByText('File')).toBeInTheDocument();
  });

  it('renders directory type', () => {
    render(<InfoPanel entry={mockDir} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Directory')).toBeInTheDocument();
  });

  it('renders file size', () => {
    render(<InfoPanel entry={mockEntry} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
  });

  it('renders permission toggles', () => {
    render(<InfoPanel entry={mockEntry} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('Permissions')).toBeInTheDocument();
    expect(screen.getAllByText('Owner').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Group').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Other')).toBeInTheDocument();
  });

  it('renders path', () => {
    render(<InfoPanel entry={mockEntry} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('/storage/test.txt')).toBeInTheDocument();
  });

  it('renders Apply Permissions button', () => {
    render(<InfoPanel entry={mockEntry} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('Apply Permissions')).toBeInTheDocument();
  });

  it('renders Close button', () => {
    render(<InfoPanel entry={mockEntry} onClose={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
