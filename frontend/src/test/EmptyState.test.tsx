import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '../components/ui/EmptyState';

vi.mock('../api/icons', () => ({
  emptyIconUrl: vi.fn(() => '/assets/empty.svg'),
}));

describe('EmptyState', () => {
  it('renders title', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<EmptyState title="Empty" subtitle="No items to show" />);
    expect(screen.getByText('No items to show')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });

  it('renders children when provided', () => {
    render(
      <EmptyState title="Empty">
        <button type="button">Retry</button>
      </EmptyState>,
    );
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('does not render extra div when no children', () => {
    const { container } = render(<EmptyState title="Empty" />);
    expect(container.querySelector('[class*="extra"]')).toBeNull();
  });

  it('uses custom icon when provided', () => {
    const { container } = render(<EmptyState title="Empty" icon="/custom/icon.svg" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/custom/icon.svg');
  });

  it('uses default icon when not provided', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/assets/empty.svg');
  });

  it('has role="status" and aria-live="polite"', () => {
    render(<EmptyState title="Empty" />);
    const el = screen.getByRole('status');
    expect(el).toHaveAttribute('aria-live', 'polite');
  });

  it('applies compact class when compact is true', () => {
    const { container } = render(<EmptyState title="Empty" compact />);
    expect(container.querySelector('[class*="compact"]')).toBeInTheDocument();
  });

  it('renders with compact size (48px icon) when compact', () => {
    const { container } = render(<EmptyState title="Empty" compact />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('width', '48');
    expect(img).toHaveAttribute('height', '48');
  });

  it('renders with default size (64px icon) when not compact', () => {
    const { container } = render(<EmptyState title="Empty" />);
    const img = container.querySelector('img');
    expect(img).toHaveAttribute('width', '64');
    expect(img).toHaveAttribute('height', '64');
  });
});
