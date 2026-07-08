import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressBar } from '../components/ui/ProgressBar';

describe('ProgressBar', () => {
  it('renders with role="progressbar"', () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelector('[role="progressbar"]')).toBeInTheDocument();
  });

  it('sets aria-valuenow to rounded value', () => {
    const { container } = render(<ProgressBar value={50.7} />);
    expect(container.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuenow', '51');
  });

  it('sets aria-valuemin to 0', () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelector('[role="progressbar"]')).toHaveAttribute('aria-valuemin', '0');
  });

  it('sets aria-valuemax to 100', () => {
    const { container } = render(<ProgressBar value={50} />);
    expect(container.querySelector('[role="progressbar"]')!).toHaveAttribute(
      'aria-valuemax',
      '100',
    );
  });

  it('sets aria-label when provided', () => {
    const { container } = render(<ProgressBar value={50} ariaLabel="Upload progress" />);
    expect(container.querySelector('[role="progressbar"]')).toHaveAttribute(
      'aria-label',
      'Upload progress',
    );
  });

  it('clamps value to 100 for the fill width', () => {
    const { container } = render(<ProgressBar value={150} />);
    const fill = container.querySelector('[class*="fill"]');
    expect(fill).toHaveStyle({ '--progress': '100%' });
  });

  it('renders correct fill width for normal values', () => {
    const { container } = render(<ProgressBar value={42} />);
    const fill = container.querySelector('[class*="fill"]');
    expect(fill).toHaveStyle({ '--progress': '42%' });
  });

  it('applies custom className', () => {
    const { container } = render(<ProgressBar value={50} className="my-class" />);
    expect(container.querySelector('[class*="track"].my-class')).toBeInTheDocument();
  });
});
