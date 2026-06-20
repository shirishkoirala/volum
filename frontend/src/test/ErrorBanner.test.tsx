import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBanner } from '../components/ui/ErrorBanner';

describe('ErrorBanner', () => {
  it('renders the error message', () => {
    render(<ErrorBanner message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders a retry button when onRetry is provided', () => {
    render(<ErrorBanner message="Error" onRetry={vi.fn()} />);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBanner message="Error" onRetry={onRetry} />);
    await user.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<ErrorBanner message="Error" onDismiss={onDismiss} />);
    await user.click(screen.getByLabelText('Dismiss error'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
