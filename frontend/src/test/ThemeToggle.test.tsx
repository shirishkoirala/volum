import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '../components/ui/ThemeToggle';

describe('ThemeToggle', () => {
  it('renders an SVG icon', () => {
    const { container } = render(<ThemeToggle theme="dark" onClick={vi.fn()} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('shows "Light mode" title in dark mode', () => {
    render(<ThemeToggle theme="dark" onClick={vi.fn()} />);
    expect(screen.getByTitle('Light mode')).toBeInTheDocument();
  });

  it('shows "Dark mode" title in light mode', () => {
    render(<ThemeToggle theme="light" onClick={vi.fn()} />);
    expect(screen.getByTitle('Dark mode')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<ThemeToggle theme="dark" onClick={onClick} />);
    await user.click(screen.getByTitle('Light mode'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ThemeToggle theme="dark" onClick={vi.fn()} className="custom-class" />,
    );
    expect(container.querySelector('.custom-class')).toBeInTheDocument();
  });

  it('renders with custom size', () => {
    const { container } = render(<ThemeToggle theme="dark" onClick={vi.fn()} size={24} />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '24');
    expect(svg).toHaveAttribute('height', '24');
  });
});
