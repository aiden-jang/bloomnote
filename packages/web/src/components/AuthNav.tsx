import type { CSSProperties, ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

const wrap: CSSProperties = {
  position: 'fixed',
  top: 'var(--chip-edge)',
  // Measured off the sound toggle's own size rather than guessed, so the two chips stay a matched
  // pair at every width.
  right: 'calc(var(--chip-edge) + var(--chip-size) + var(--chip-gap))',
  zIndex: 50,
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  fontSize: '0.85rem',
  letterSpacing: '0.01em',
  height: 'var(--chip-size)',
  boxSizing: 'border-box',
  padding: '0 14px',
  // Never let the pill run past the viewport's left edge on a phone: it grows leftward from
  // right:64, and a long name would push it across the centred header title.
  maxWidth: 'calc(100vw - var(--chip-edge) * 2 - var(--chip-size) - var(--chip-gap) * 2)',
  background: 'rgba(247, 245, 236, 0.94)',
  border: '1px solid var(--green-pale, #e2e8dc)',
  borderRadius: 12,
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
}
const link: CSSProperties = {
  color: 'var(--color-ink-muted, #6b6963)',
  textDecoration: 'none',
  cursor: 'pointer',
  background: 'none',
  border: 'none',
  font: 'inherit',
  padding: 0,
  whiteSpace: 'nowrap',
  /* Fill the chip's height. The pill around this is a plain div and never the pointer target. */
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
}
// The display name is user-controlled and unbounded, so truncate or it grows the pill.
const nameLink: CSSProperties = {
  ...link,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '8rem',
}

export function AuthNav(): ReactNode {
  const { user, loading, login, logout, accountUrl } = useAuth()
  if (loading) return null

  if (!user) {
    return (
      <div style={wrap} data-screen-chrome="">
        <button type="button" style={link} onClick={() => login()}>
          sign in
        </button>
      </div>
    )
  }

  return (
    <div style={wrap} data-screen-chrome="">
      <a style={link} href="/mine">
        your gardens
      </a>
      <a style={nameLink} href={accountUrl} title={user.displayName}>
        {user.displayName}
      </a>
      <button type="button" style={link} onClick={() => logout()}>
        sign out
      </button>
    </div>
  )
}
