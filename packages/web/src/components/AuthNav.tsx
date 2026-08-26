import type { CSSProperties, ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'

// A quiet corner entry point. Accounts are optional (anonymous create + links always work),
// so this stays out of the way: "sign in" when signed out; name + "your gardens" + sign-out when
// signed in. Copy is lowercase to match bloomnote's aesthetic.
const wrap: CSSProperties = {
  position: 'fixed',
  top: 'var(--chip-edge)',
  // Sit one gap to the left of the sound toggle, measured off the toggle's own size rather than a
  // guess at it, so the two chips stay a matched pair at every width.
  right: 'calc(var(--chip-edge) + var(--chip-size) + var(--chip-gap))',
  zIndex: 50,
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  fontSize: '0.85rem',
  letterSpacing: '0.01em',
  // Translucent cream chip (matching the sound toggle) so the links stay legible over whatever
  // content scrolls behind this fixed bar. Height comes from the shared chip token instead of from
  // padding, so this pill and the toggle share a centre line and not just a top edge.
  height: 'var(--chip-size)',
  boxSizing: 'border-box',
  padding: '0 14px',
  // Never let the pill run past the viewport's left edge on a phone (it grows leftward from
  // right:64). The display name inside also truncates, so a long name can't push it across the
  // centered header title.
  maxWidth: 'calc(100vw - var(--chip-edge) * 2 - var(--chip-size) - var(--chip-gap) * 2)',
  background: 'rgba(250, 246, 238, 0.82)',
  border: '1px solid var(--green-pale, #e2e8dc)',
  borderRadius: 999,
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
  /* Fill the chip's height. The pill around this is a plain div and never the pointer target, so
     an 18px line inside a 38px pill left the real target under the 24px minimum. */
  alignSelf: 'stretch',
  display: 'flex',
  alignItems: 'center',
}
// The display name is user-controlled and unbounded — truncate it so it can't grow the pill.
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
