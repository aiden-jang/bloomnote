import { Fragment, type CSSProperties } from 'react'
import { siteFooterLinks } from '@aidenjang/auth-client'
import { AUTH_ORIGIN } from '../auth/AuthContext'

// The one site footer, rendered under every bloomnote view (see App.tsx). Content (credit +
// the shared legal pages) comes from siteFooterLinks so it stays in sync across apps; the
// styling below is bloomnote's own theme so the footer matches the app.
const links = siteFooterLinks(AUTH_ORIGIN)

const wrap: CSSProperties = {
  padding: '2.5rem 1.5rem',
  textAlign: 'center',
  fontSize: '0.8rem',
  color: 'var(--color-ink-muted, #6b6963)',
}
const link: CSSProperties = { color: 'inherit', textDecoration: 'none' }

export default function Footer() {
  return (
    <footer style={wrap}>
      {links.map((item, i) => (
        <Fragment key={item.href}>
          {i > 0 && ' · '}
          <a
            href={item.href}
            style={link}
            {...(item.external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            {item.label}
          </a>
        </Fragment>
      ))}
    </footer>
  )
}
