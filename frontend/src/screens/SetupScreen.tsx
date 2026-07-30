import { FormEvent, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { setup } from '../api/client-auth';
import type { Session } from '../api/client-auth';

import styles from './LoginScreen.module.css';

type SetupScreenProps = {
  onComplete: (session: Session) => void;
};

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [bootstrapToken, setBootstrapToken] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    setError(null);
    setup(username, password, bootstrapToken)
      .then(onComplete)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className={styles.authShell}>
      <form className={styles.loginPanel} onSubmit={handleSubmit}>
        <img className={styles.brandMark} src="/volum_logo.svg" alt="" />
        <h1>Setup Admin Account</h1>
        <p
          style={{
            margin: 0,
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          Enter the setup token from the server log and create the first administrator.
        </p>
        <label className={styles.setupField} htmlFor="setup-token">
          <span>Setup token</span>
          <input
            id="setup-token"
            autoFocus
            autoComplete="one-time-code"
            required
            type="password"
            value={bootstrapToken}
            onChange={(event) => {
              setBootstrapToken(event.target.value);
              setError(null);
            }}
          />
        </label>
        <label className={styles.setupField} htmlFor="setup-username">
          <span>Username</span>
          <input
            id="setup-username"
            autoComplete="username"
            required
            type="text"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setError(null);
            }}
          />
        </label>
        <label className={styles.setupField} htmlFor="setup-password">
          <span>Password</span>
          <input
            id="setup-password"
            aria-describedby="setup-password-help"
            autoComplete="new-password"
            minLength={12}
            required
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError(null);
            }}
          />
          <small id="setup-password-help">At least 12 characters.</small>
        </label>
        <label className={styles.setupField} htmlFor="setup-confirm-password">
          <span>Confirm password</span>
          <input
            id="setup-confirm-password"
            autoComplete="new-password"
            minLength={12}
            required
            type="password"
            value={confirm}
            onChange={(event) => {
              setConfirm(event.target.value);
              setError(null);
            }}
          />
        </label>
        {error && (
          <p className={styles.loginError} role="alert">
            {error}
          </p>
        )}
        <button
          disabled={
            submitting ||
            bootstrapToken.length === 0 ||
            username.length === 0 ||
            password.length < 12 ||
            confirm.length < 12
          }
          type="submit"
        >
          {submitting ? (
            <>
              <Icon name="view-refresh" size={16} /> Creating...
            </>
          ) : (
            'Create Admin'
          )}
        </button>
      </form>
    </main>
  );
}
