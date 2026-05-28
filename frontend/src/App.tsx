import { useEffect, useState } from 'react';
import { getSession, logout, Session } from './api/client';
import { LoginScreen } from './screens/LoginScreen';
import { Home } from './screens/Home';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import styles from './App.module.css';

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('volum_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then(setSession)
      .catch((err: Error) => console.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('volum_theme', theme);
  }, [theme]);

  const handleLoggedIn = (nextSession: Session) => setSession(nextSession);
  const handleLogout = () => {
    void logout().then((nextSession) => setSession(nextSession));
  };

  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      {loading ? (
        <div className={styles.authShell}>Loading...</div>
      ) : session?.authEnabled && !session.authenticated ? (
        <LoginScreen onLoggedIn={handleLoggedIn} />
      ) : (
        <ErrorBoundary>
          <Home
            session={session!}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        </ErrorBoundary>
      )}
    </div>
  );
}
