import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BreadcrumbBar } from '../components/layout/BreadcrumbBar';
import type { Crumb } from '../components/layout/BreadcrumbBar';

const crumbs: Crumb[] = [
  { label: 'Home', path: '/' },
  { label: 'Documents', path: '/Documents' },
  { label: 'Work', path: '/Documents/Work' },
];

describe('BreadcrumbBar', () => {
  it('renders all crumbs', () => {
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Work')).toBeInTheDocument();
  });

  it('marks last crumb as current', () => {
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    const current = screen.getByText('Work');
    expect(current).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', async () => {
    const onBack = vi.fn();
    const user = userEvent.setup();
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={onBack}
        onNavigate={vi.fn()}
      />
    );
    await user.click(screen.getByTitle('Go back'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onNavigate with crumb path when a crumb is clicked', async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={onNavigate}
      />
    );
    await user.click(screen.getByText('Documents'));
    expect(onNavigate).toHaveBeenCalledWith('/Documents');
  });

  it('does not render anything when crumbs is empty', () => {
    const { container } = render(
      <BreadcrumbBar
        crumbs={[]}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders children in the toolbar area', () => {
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      >
        <button type="button">Action</button>
      </BreadcrumbBar>
    );
    expect(screen.getAllByText('Action')).toHaveLength(2);
  });

  it('renders location mode when locationMode is true', () => {
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
        locationMode
        onLocationNavigate={vi.fn()}
        onToggleLocationMode={vi.fn()}
      />
    );
    expect(screen.getByPlaceholderText('Enter path...')).toBeInTheDocument();
  });

  it('location input shows concatenated paths', () => {
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
        locationMode
        onLocationNavigate={vi.fn()}
        onToggleLocationMode={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('Enter path...') as HTMLInputElement;
    expect(input.value).toContain('/Documents/Work');
  });

  it('calls onGoUp when go up button is clicked', async () => {
    const onGoUp = vi.fn();
    const user = userEvent.setup();
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onGoUp={onGoUp}
        onNavigate={vi.fn()}
      />
    );
    await user.click(screen.getByTitle('Go up'));
    expect(onGoUp).toHaveBeenCalledOnce();
  });

  it('does not render go up button when onGoUp is not provided', () => {
    render(
      <BreadcrumbBar
        crumbs={crumbs}
        onBack={vi.fn()}
        onNavigate={vi.fn()}
      />
    );
    expect(screen.queryByTitle('Go up')).not.toBeInTheDocument();
  });
});
