import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BreadcrumbNav } from '../components/layout/BreadcrumbNav';

describe('BreadcrumbNav', () => {
  it('places hidden ancestors between the root and current folder', async () => {
    const clientWidth = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(150);
    const offsetWidth = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);

    try {
      render(
        <BreadcrumbNav
          crumbs={[
            { label: 'Storage', path: '/storage' },
            { label: 'Projects', path: '/storage/projects' },
            { label: 'Volum', path: '/storage/projects/volum' },
            { label: 'Frontend', path: '/storage/projects/volum/frontend' },
          ]}
          onNavigate={vi.fn()}
        />,
      );

      const root = screen.getByRole('button', { name: 'Storage' });
      const overflow = await screen.findByRole('button', {
        name: 'Show hidden breadcrumb folders',
      });
      const current = screen.getByText('Frontend');

      expect(
        root.compareDocumentPosition(overflow) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        overflow.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(current).toHaveAttribute('aria-current', 'page');
    } finally {
      clientWidth.mockRestore();
      offsetWidth.mockRestore();
    }
  });
});
