import type { MiddlewareHandler } from 'hono'

/** Conservative CSP the Vite SPAs run under unchanged. 'unsafe-inline' is on style-src only,
    because Vite inlines critical CSS and React sets inline styles; script-src stays 'self'. */
export const DEFAULT_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "connect-src 'self' https://static.cloudflareinsights.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ')

/** Disable device APIs no app uses. wherever overrides this to allow geolocation. */
export const DEFAULT_PERMISSIONS_POLICY =
  'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'

export interface SecurityHeaderOptions {
  csp?: string
  permissionsPolicy?: string
}

export function securityHeaders(opts: SecurityHeaderOptions = {}): Record<string, string> {
  return {
    'Content-Security-Policy': opts.csp ?? DEFAULT_CSP,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Permissions-Policy': opts.permissionsPolicy ?? DEFAULT_PERMISSIONS_POLICY,
  }
}

export function applySecurityHeaders(headers: Headers, opts: SecurityHeaderOptions = {}): Headers {
  for (const [key, value] of Object.entries(securityHeaders(opts))) headers.set(key, value)
  return headers
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Defense in depth. The primary CSRF defense is the platform_session cookie's SameSite=Lax,
    so this is the second lock, not the only one. */
export function enforceSameOrigin(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method)) return null
  const origin = request.headers.get('Origin')
  if (origin === null) return null
  let originUrl: URL
  try {
    originUrl = new URL(origin)
  } catch {
    return forbidden()
  }
  if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') return null
  if (originUrl.host !== new URL(request.url).host) return forbidden()
  return null
}

function forbidden(): Response {
  return new Response(JSON.stringify({ error: 'cross-origin request rejected' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

export interface HardenOptions extends SecurityHeaderOptions {
  csrf?: boolean
}

export function harden(opts: HardenOptions = {}): MiddlewareHandler {
  const { csrf = true, ...headerOpts } = opts
  return async (c, next) => {
    if (csrf) {
      const blocked = enforceSameOrigin(c.req.raw)
      if (blocked) return blocked
    }
    await next()
    const res = c.res
    if (res.status === 101) return
    const headers = new Headers(res.headers)
    applySecurityHeaders(headers, headerOpts)
    c.res = new Response(res.body, { status: res.status, statusText: res.statusText, headers })
  }
}
