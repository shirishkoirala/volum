import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Icon, FileIcon, FolderIcon, DeviceIcon, TrashIcon } from '../components/ui/Icon';
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

describe('Icon', () => {
  it('renders an svg for known action', () => {
    const { container } = render(<Icon name="window-close" size={18} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders an svg for unknown action', () => {
    const { container } = render(<Icon name="nonexistent" size={18} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});

describe('FileIcon', () => {
  it('renders an img with alt attribute', () => {
    const { container } = render(<FileIcon entry={mockEntry} size={22} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('alt', '');
  });
});

describe('FolderIcon', () => {
  it('renders an img', () => {
    const { container } = render(<FolderIcon size={22} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });
});

describe('DeviceIcon', () => {
  it('renders an img for drive', () => {
    const { container } = render(<DeviceIcon size={64} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });
});

describe('TrashIcon', () => {
  it('renders empty trash img', () => {
    const { container } = render(<TrashIcon full={false} size={22} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });

  it('renders full trash img', () => {
    const { container } = render(<TrashIcon full={true} size={22} />);
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
  });
});
