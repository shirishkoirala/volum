import { useCallback, useEffect, useState } from 'react';
import { getSession, logout, profileAvatarUrl, type Session } from './api/client-auth';
import { LoginScreen } from './screens/LoginScreen';
import { SetupScreen } from './screens/SetupScreen';
import { Home } from './screens/Home';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { WindowManagerProvider } from './contexts/WindowManagerProvider';
import styles from './App.module.css';

async function getProfileAvatarData(): Promise<string> {
  const response = await fetch(profileAvatarUrl(), { credentials: 'include' });
  if (!response.ok) throw new Error('Profile image unavailable');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not cache profile image'));
    reader.readAsDataURL(blob);
  });
}

export function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem('volum_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setSessionError(null);
    try {
      setSession(await getSession());
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : 'Volum is unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      getSession()
        .then((nextSession) => {
          setSession(nextSession);
          setSessionError(null);
        })
        .catch((error: Error) => setSessionError(error.message));
    };
    window.addEventListener('volum:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('volum:unauthorized', handleUnauthorized);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('volum_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (session?.authenticated && session.username)
      localStorage.setItem('volum_last_user', JSON.stringify({ username: session.username }));
  }, [session]);

  const handleLoggedIn = (nextSession: Session) => setSession(nextSession);
  const handleLogout = async () => {
    if (session?.authenticated && session.username) {
      const savedUser: { username: string; avatarDataUrl?: string } = {
        username: session.username,
      };
      if (session.hasAvatar) {
        try {
          savedUser.avatarDataUrl = await getProfileAvatarData();
        } catch {
          /* empty */
        }
      }
      localStorage.setItem('volum_last_user', JSON.stringify(savedUser));
    }
    setSessionError(null);
    try {
      setSession(await logout());
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('Could not log out');
      setSessionError(failure.message);
      throw failure;
    }
  };

  if (loading) {
    return (
      <div className={styles.authShell} role="status">
        Connecting to Volum…
      </div>
    );
  }

  if (!session) {
    return (
      <div className={styles.authShell}>
        <section className={styles.connectionCard} aria-labelledby="connection-title">
          <img src="/volum_logo.svg" alt="" />
          <h1 id="connection-title">Volum is unavailable</h1>
          <p>{sessionError || 'The server did not return a session.'}</p>
          <button type="button" onClick={() => void loadSession()}>
            Try again
          </button>
        </section>
      </div>
    );
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
            session={session}
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
