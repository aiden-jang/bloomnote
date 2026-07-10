import type { CSSProperties, ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

// A quiet corner entry point. Accounts are optional (anonymous create + links always work),
// so this stays out of the way: "sign in" when signed out; name + "your gardens" + sign-out when
// signed in. Copy is lowercase to match bloomnote's aesthetic.
const wrap: CSSProperties = {
  position: 'fixed',
  top: 14,
  // Sit to the left of the fixed sound toggle (top-right, ~52px wide) so they don't overlap.
  right: 64,
  zIndex: 50,
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  fontSize: '0.85rem',
  letterSpacing: '0.01em',
  // Translucent cream chip (matching the sound toggle) so the links stay legible over whatever
  // content scrolls behind this fixed bar.
  padding: '7px 14px',
  background: 'rgba(250, 246, 238, 0.82)',
  border: '1px solid var(--green-pale, #e2e8dc)',
  borderRadius: 999,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
};
const link: CSSProperties = {
  color: 'var(--color-ink-muted, #6b6963)',
  textDecoration: 'none',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  font: 'inherit',
  padding: 0,
};

export function AuthNav(): ReactNode {
  const { user, loading, login, logout, accountUrl } = useAuth();
  if (loading) return null;

  if (!user) {
    return (
      <div style={wrap}>
        <button type="button" style={link} onClick={() => login()}>
          sign in
        </button>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <a style={link} href="/mine">
        your gardens
      </a>
      <a style={link} href={accountUrl}>
        {user.displayName}
      </a>
      <button type="button" style={link} onClick={() => logout()}>
        sign out
      </button>
    </div>
  );
}
