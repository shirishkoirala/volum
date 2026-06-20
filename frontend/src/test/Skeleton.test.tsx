import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../components/ui/Skeleton';

describe('Skeleton', () => {
  it('renders the correct number of items', () => {
    const { container } = render(<Skeleton variant="row" count={4} />);
    expect(container.querySelectorAll('[class*="skeleton"]')).toHaveLength(4);
  });

  it('renders a single item by default', () => {
    const { container } = render(<Skeleton variant="card" />);
    expect(container.querySelectorAll('[class*="skeleton"]')).toHaveLength(1);
  });

  it('applies the variant class', () => {
    const { container } = render(<Skeleton variant="card" />);
    expect(container.querySelector('[class*="card"]')).toBeInTheDocument();
  });

  it('applies custom width and height styles', () => {
    const { container } = render(<Skeleton variant="line" width="50%" height="20px" />);
    const el = container.querySelector('[class*="skeleton"]') as HTMLElement;
    expect(el.style.width).toBe('50%');
    expect(el.style.height).toBe('20px');
  });
});
