import { useEffect, useState } from 'react';
import { getSession, logout, Session } from './api/client';
import { LoginScreen } from './screens/LoginScreen';
import { SetupScreen } from './screens/SetupScreen';
import { Home } from './screens/Home';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { WindowManagerProvider } from './contexts/WindowManagerProvider';
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

  useEffect(() => {
    if (session?.authenticated && session.username)
      localStorage.setItem('volum_last_user', session.username);
  }, [session]);

  const handleLoggedIn = (nextSession: Session) => setSession(nextSession);
  const handleLogout = () => {
    if (session?.authenticated && session.username)
      localStorage.setItem('volum_last_user', session.username);
    void logout()
      .then(setSession)
      .catch(() => setSession(null));
  };

  if (loading) {
    return <div className={styles.authShell}>Loading...</div>;
  }

  if (session?.setupRequired) {
    return <SetupScreen onComplete={handleLoggedIn} />;
  }

  if (session?.authEnabled && !session.authenticated) {
    return (
      <LoginScreen
        onLoggedIn={handleLoggedIn}
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      />
    );
  }

  return (
    <div onContextMenu={(e) => e.preventDefault()}>
      <ErrorBoundary>
        <WindowManagerProvider>
          <Home
            session={session!}
            onSessionChange={setSession}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        </WindowManagerProvider>
      </ErrorBoundary>
    </div>
  );
}
