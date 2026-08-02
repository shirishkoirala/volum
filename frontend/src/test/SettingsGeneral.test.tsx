import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SettingsGeneral } from '../components/settings/SettingsGeneral';
import { buildSession } from './fixtures';

describe('SettingsGeneral', () => {
  it('keeps the session visible and reports a failed logout', async () => {
    let rejectLogout: ((reason: Error) => void) | undefined;
    const onLogout = vi.fn(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectLogout = reject;
        }),
    );
    const user = userEvent.setup();
    render(
      <SettingsGeneral
        session={buildSession({ username: 'admin' })}
        theme="light"
        onToggleTheme={vi.fn()}
        onOpenShortcuts={vi.fn()}
        onLogout={onLogout}
        onSessionChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Log Out' }));
    expect(screen.getByRole('button', { name: 'Logging out…' })).toBeDisabled();

    await act(async () => rejectLogout?.(new Error('Server unavailable')));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    expect(screen.getByRole('button', { name: 'Log Out' })).toBeEnabled();
    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(onLogout).toHaveBeenCalledOnce();
  });
});
