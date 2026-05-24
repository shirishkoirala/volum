import { FormEvent, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { Select } from '../components/input/Select';
import { login } from '../api/client';
import type { Session } from '../api/client';
import appIcon from '../assets/icon-light.png';
import styles from './LoginScreen.module.css';

type LoginScreenProps = {
  onLoggedIn: (session: Session) => void;
};

export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  const [role, setRole] = useState<'admin' | 'readonly'>('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    login(role, password)
      .then(onLoggedIn)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className={styles.authShell}>
      <form className={styles.loginPanel} onSubmit={handleSubmit}>
        <img className={styles.brandMark} src={appIcon} alt="" />
        <h1>Volum Desktop</h1>
        <Select value={role} onChange={(value) => setRole(value as 'admin' | 'readonly')}>
          <option value="admin">Admin</option>
          <option value="readonly">Readonly</option>
        </Select>
        <input
          autoFocus
          placeholder="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className={styles.loginError}>{error}</p>}
        <button disabled={submitting || password.length === 0} type="submit">
          {submitting ? <><Icon name="view-refresh" size={16} /> Logging in...</> : 'Log in'}
        </button>
      </form>
    </main>
  );
}
