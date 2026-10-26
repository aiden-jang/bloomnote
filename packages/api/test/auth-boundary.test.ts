import { SELF, env } from 'cloudflare:test'
import { afterEach, describe, expect, it, vi } from 'vitest'

/*
 * A signed-in caller whose auth service is unreachable must not be told they are signed out.
 * The clients act on a 401 by dropping what they hold, so answering one for an outage costs
 * somebody their archive rather than one request.
 */
const AUTH = new URL(env.AUTH_URL).origin

/* The worker runs in this isolate, so stubbing fetch here is what it calls. Anything but the auth
   service is a mistake worth failing on rather than quietly letting out to the network. */
function authReplies(status: number, body: unknown): void {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== AUTH) throw new Error(`unexpected fetch to ${url.origin}`)
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
  })
}

afterEach(() => vi.unstubAllGlobals())

const authed = (path: string, init: RequestInit = {}) =>
  SELF.fetch(`https://x${path}`, { headers: { cookie: 'session=abc' }, ...init })

describe('the authenticated routes', () => {
  it('answers 401 when there is no session at all', async () => {
    const res = await SELF.fetch('https://x/api/mine')
    expect(res.status).toBe(401)
    expect((await res.json<{ error: string }>()).error).toBe('UNAUTHENTICATED')
  })

  it('answers 401 when the auth service says the session is not valid', async () => {
    authReplies(401, {})
    const res = await authed('/api/mine')
    expect(res.status).toBe(401)
    expect((await res.json<{ error: string }>()).error).toBe('UNAUTHENTICATED')
  })

  it('answers 503, not 401, when the auth service is failing', async () => {
    authReplies(500, { error: 'nope' })
    const res = await authed('/api/mine')
    expect(res.status).toBe(503)
    expect((await res.json<{ error: string }>()).error).toBe('AUTH_UNAVAILABLE')
    expect(res.headers.get('retry-after')).toBe('30')
  })

  it('serves the account once the session resolves', async () => {
    authReplies(200, { user: { id: 'u1', email: 'a@b.c', displayName: 'A' } })
    const res = await authed('/api/mine')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: [], received: [] })
  })
})

describe('checking the session', () => {
  it.each([500, 503])('reports an Accounts %i as retryable, rather than signed out', async (status) => {
    authReplies(status, { error: 'down' })
    const res = await authed('/api/me')
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: 'AUTH_UNAVAILABLE' })
    expect(res.headers.get('retry-after')).toBe('30')
    expect(res.headers.get('cache-control')).toContain('no-store')
  })

  it('still recognizes an invalid session as signed out', async () => {
    authReplies(401, {})
    const res = await authed('/api/me')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ user: null })
  })
})
