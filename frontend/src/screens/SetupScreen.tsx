import { FormEvent, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { setup } from '../api/client';
import type { Session } from '../api/client';
import appIcon from '../assets/volum-glass-folder.svg';
import styles from './LoginScreen.module.css';

type SetupScreenProps = {
  onComplete: (session: Session) => void;
};

export function SetupScreen({ onComplete }: SetupScreenProps) {
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
    setup(username, password)
      .then(onComplete)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className={styles.authShell}>
      <form className={styles.loginPanel} onSubmit={handleSubmit}>
        <img className={styles.brandMark} src={appIcon} alt="" />
        <h1>Setup Admin Account</h1>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-sm)' }}>
          Create the first admin user to get started.
        </p>
        <input
          autoFocus
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
        <button disabled={submitting || username.length === 0 || password.length === 0 || confirm.length === 0} type="submit">
          {submitting ? <><Icon name="view-refresh" size={16} /> Creating...</> : 'Create Admin'}
        </button>
      </form>
    </main>
  );
}
