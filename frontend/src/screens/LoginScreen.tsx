import { FormEvent, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { login } from '../api/client';
import type { Session } from '../api/client';
import appIcon from '../assets/volum-glass-folder.svg';
import styles from './LoginScreen.module.css';

type LoginScreenProps = {
  onLoggedIn: (session: Session) => void;
};

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    login(username, password)
      .then(onLoggedIn)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className={styles.authShell}>
      <form className={styles.loginPanel} onSubmit={handleSubmit}>
        <img className={styles.brandMark} src={appIcon} alt="" />
        <h1>Volum Desktop</h1>
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
        {error && <p className={styles.loginError}>{error}</p>}
        <button disabled={submitting || username.length === 0 || password.length === 0} type="submit">
          {submitting ? <><Icon name="view-refresh" size={16} /> Logging in...</> : 'Log in'}
        </button>
      </form>
    </main>
  );
}
