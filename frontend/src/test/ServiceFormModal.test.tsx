import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceFormModal } from '../components/overlay/ServiceFormModal';

vi.mock('../utils/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/services')>();
  return {
    ...actual,
    detectFavicon: vi.fn().mockResolvedValue(null),
  };
});

describe('ServiceFormModal', () => {
  it('autofocuses the name input and allows focusing other fields', async () => {
    const user = userEvent.setup();
    render(<ServiceFormModal onSave={vi.fn()} onClose={vi.fn()} />);

    const nameInput = screen.getByLabelText('Name');
    const urlInput = screen.getByLabelText('URL');

    expect(nameInput).toHaveFocus();

    await user.click(urlInput);
    expect(urlInput).toHaveFocus();
  }, 10000);

  it('submits a new service when Add is clicked', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Codex Test Service' } });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com/codex-service-test' },
    });
    fireEvent.change(screen.getByLabelText('Icon URL (optional)'), {
      target: { value: 'https://example.com/favicon.ico' },
    });
    fireEvent.change(screen.getByLabelText('Health Check URL (optional)'), {
      target: { value: 'https://example.com/health' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      name: 'Codex Test Service',
      url: 'https://example.com/codex-service-test',
      iconUrl: 'https://example.com/favicon.ico',
      healthUrl: 'https://example.com/health',
      description: undefined,
      openMode: 'embed',
    });
  });

  it('submits when Enter is pressed in a filled field', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);

    const urlInput = screen.getByLabelText('URL');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Docs' } });
    fireEvent.change(urlInput, { target: { value: 'https://docs.example.com' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      name: 'Docs',
      url: 'https://docs.example.com',
      iconUrl: undefined,
      healthUrl: undefined,
      description: undefined,
      openMode: 'embed',
    });
  });

  it('shows validation errors and does not submit invalid service data', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Invalid Service' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'ftp://example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.getByText('Enter a valid http:// or https:// URL.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('validates health check URL when provided', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Invalid Health' } });
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } });
    fireEvent.change(screen.getByLabelText('Health Check URL (optional)'), {
      target: { value: 'ftp://example.com/health' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      screen.getByText('Enter a valid health check http:// or https:// URL.'),
    ).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps entered values visible when saving fails', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Server unavailable'));
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Service' } });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Server unavailable')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('My Service');
    expect(screen.getByLabelText('URL')).toHaveValue('https://example.com');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while a save is pending', async () => {
    let finishSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Pending Service' } });
    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => finishSave?.());
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('renders edit mode with initial values and saves edits', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <ServiceFormModal
        initial={{
          id: 'svc-1',
          name: 'Existing',
          url: 'https://old.example.com',
          iconUrl: 'https://old.example.com/favicon.ico',
          healthUrl: 'https://old.example.com/health',
        }}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Service' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('URL'), {
      target: { value: 'https://new.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      name: 'Existing',
      url: 'https://new.example.com',
      iconUrl: 'https://old.example.com/favicon.ico',
      healthUrl: 'https://old.example.com/health',
      description: undefined,
      openMode: 'embed',
    });
  });
});
