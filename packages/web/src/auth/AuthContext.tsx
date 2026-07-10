import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loginUrl, logoutUrl } from '@aidenjang/auth-client';

// The shared auth service. Sign-in/out are full-page redirects here; identity itself comes
// from the same-origin /api/me (no cross-origin fetch). Accounts are optional in bloomnote —
// anonymous create + public links always work. In dev the auth Worker serves the login UI + API
// from one origin on :34100 (wrangler dev), so default there rather than sending local logins to
// production. VITE_AUTH_URL overrides either way.
export const AUTH_ORIGIN =
  import.meta.env.VITE_AUTH_URL ??
  (import.meta.env.DEV ? 'http://localhost:34100' : 'https://accounts.aidenjang.com');

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (returnTo?: string) => void;
  logout: (returnTo?: string) => void;
  accountUrl: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactNode {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d: { user: AuthUser | null }) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: (returnTo?: string) => {
        window.location.assign(loginUrl(AUTH_ORIGIN, returnTo ?? window.location.href));
      },
      logout: (returnTo?: string) => {
        window.location.assign(logoutUrl(AUTH_ORIGIN, returnTo ?? window.location.origin));
      },
      accountUrl: new URL('/account', AUTH_ORIGIN).toString(),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
