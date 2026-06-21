import { FormEvent, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { setup } from '../api/client';
import type { Session } from '../api/client';
import { BRAND_ICON_URL } from '../utils/brand';
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
        <img className={styles.brandMark} src={BRAND_ICON_URL} alt="" />
        <h1>Setup Admin Account</h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Enter the setup token from the server log and create the first administrator.
        </p>
        <input
          autoFocus
          autoComplete="one-time-code"
          placeholder="Setup token"
          type="password"
          value={bootstrapToken}
          onChange={(event) => setBootstrapToken(event.target.value)}
        />
        <input
          autoComplete="username"
          placeholder="Username"
          type="text"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <input
          placeholder="Confirm password"
          type="password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
        {error && <p className={styles.loginError}>{error}</p>}
        <button disabled={submitting || bootstrapToken.length === 0 || username.length === 0 || password.length === 0 || confirm.length === 0} type="submit">
          {submitting ? <><Icon name="view-refresh" size={16} /> Creating...</> : 'Create Admin'}
        </button>
      </form>
    </main>
  );
}
