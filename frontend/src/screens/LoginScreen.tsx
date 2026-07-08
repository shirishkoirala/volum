import { FormEvent, useState } from 'react';
import { Icon } from '../components/ui/Icon';
import { ThemeToggle } from '../components/ui/ThemeToggle';
import { login } from '../api/client';
import type { Session } from '../api/client';
import { BRAND_ICON_URL } from '../utils/brand';
import { loadLastUser } from '../utils/lastUser';
import styles from './LoginScreen.module.css';

type LoginScreenProps = {
  onLoggedIn: (session: Session) => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
};

export function LoginScreen({ onLoggedIn, onToggleTheme, theme }: LoginScreenProps) {
  const [lastUser] = useState(loadLastUser);
  const [username, setUsername] = useState(lastUser?.username ?? '');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    login(username, password, rememberMe)
      .then(onLoggedIn)
      .catch((err: Error) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

  return (
    <main className={styles.authShell}>
      <div className={styles.brandHeader} aria-label="Volum Desktop">
        <img src={BRAND_ICON_URL} alt="" />
        <span>Volum</span>
      </div>
      <ThemeToggle theme={theme} onClick={onToggleTheme} className={styles.themeToggle} size={17} />
      <form className={styles.loginPanel} onSubmit={handleSubmit}>
        <div className={styles.profileTile}>
          {lastUser?.avatarDataUrl ? (
            <img
              className={styles.profileImage}
              src={lastUser.avatarDataUrl}
              alt={`Profile for ${lastUser.username}`}
            />
          ) : (
            <Icon name="avatar-default" size={30} />
          )}
        </div>
        <div className={styles.loginHeading}>
          <h1>Sign in to Volum</h1>
          <p>Access your files and services.</p>
        </div>
        <label className={styles.loginField}>
          <Icon name="avatar-default" size={17} />
          <input
            aria-label="Username"
            autoComplete="username"
            data-control="embedded"
            autoFocus
            placeholder="Username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className={styles.loginField}>
          <Icon name="system-lock-screen" size={17} />
          <input
            aria-label="Password"
            autoComplete="current-password"
            data-control="embedded"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <label className={styles.rememberRow}>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(event) => setRememberMe(event.target.checked)}
          />
          <span>Remember me</span>
        </label>
        {error && <p className={styles.loginError}>{error}</p>}
        <button
          disabled={submitting || username.length === 0 || password.length === 0}
          type="submit"
        >
          {submitting ? (
            <>
              <Icon name="view-refresh" size={16} /> Logging in...
            </>
          ) : (
            'Log in'
          )}
        </button>
      </form>
    </main>
  );
}
