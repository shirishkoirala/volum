import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ServiceFormModal } from '../components/overlay/ServiceFormModal';

vi.mock('../utils/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/services')>();
  return {
    ...actual,
    detectFavicon: vi.fn().mockResolvedValue(null),
  };
});

describe('ServiceFormModal', () => {
  it('submits a new service when Add is clicked', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({
      name: 'Codex Test Service',
      url: 'https://example.com/codex-service-test',
      iconUrl: 'https://example.com/favicon.ico',
    });
  });

  it('submits when Enter is pressed in a filled field', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<ServiceFormModal onSave={onSave} onClose={onClose} />);

    const urlInput = screen.getByLabelText('URL');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Docs' } });
    fireEvent.change(urlInput, { target: { value: 'https://docs.example.com' } });
    fireEvent.keyDown(urlInput, { key: 'Enter' });

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({
      name: 'Docs',
      url: 'https://docs.example.com',
      iconUrl: undefined,
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

  it('renders edit mode with initial values and saves edits', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <ServiceFormModal
        initial={{
          id: 'svc-1',
          name: 'Existing',
          url: 'https://old.example.com',
          iconUrl: 'https://old.example.com/favicon.ico',
        }}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Edit Service' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://new.example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledWith({
      name: 'Existing',
      url: 'https://new.example.com',
      iconUrl: 'https://old.example.com/favicon.ico',
    });
  });
});
