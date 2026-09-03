import { SELF, env, fetchMock } from 'cloudflare:test'
import { beforeAll, afterEach, describe, expect, it } from 'vitest'

/*
 * A signed-in caller whose auth service is unreachable must not be told they are signed out.
 * The clients act on a 401 by dropping what they hold, so answering one for an outage costs
 * somebody their archive rather than one request.
 */
const AUTH = new URL(env.AUTH_URL).origin

beforeAll(() => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
})
afterEach(() => fetchMock.assertNoPendingInterceptors())

const authed = (path: string, init: RequestInit = {}) =>
  SELF.fetch(`https://x${path}`, { headers: { cookie: 'session=abc' }, ...init })

describe('the authenticated routes', () => {
  it('answers 401 when there is no session at all', async () => {
    const res = await SELF.fetch('https://x/api/mine')
    expect(res.status).toBe(401)
    expect((await res.json<{ error: string }>()).error).toBe('UNAUTHENTICATED')
  })

  it('answers 401 when the auth service says the session is not valid', async () => {
    fetchMock.get(AUTH).intercept({ path: '/auth/me' }).reply(401, {})
    const res = await authed('/api/mine')
    expect(res.status).toBe(401)
    expect((await res.json<{ error: string }>()).error).toBe('UNAUTHENTICATED')
  })

  it('answers 503, not 401, when the auth service is failing', async () => {
    fetchMock.get(AUTH).intercept({ path: '/auth/me' }).reply(500, 'nope')
    const res = await authed('/api/mine')
    expect(res.status).toBe(503)
    expect((await res.json<{ error: string }>()).error).toBe('AUTH_UNAVAILABLE')
    expect(res.headers.get('retry-after')).toBe('30')
  })

  it('serves the account once the session resolves', async () => {
    fetchMock
      .get(AUTH)
      .intercept({ path: '/auth/me' })
      .reply(200, { user: { id: 'u1', email: 'a@b.c', displayName: 'A' } })
    const res = await authed('/api/mine')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ sent: [], received: [] })
  })
})
