import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

/**
 * bloomnote is anonymous-first, so these endpoints cannot ask who is calling, and gardens are
 * stored with no expiry. Anything a script writes is permanent, which is what these guard.
 */
const post = (path: string, ip: string, body?: unknown) =>
  SELF.fetch(`https://x${path}`, {
    method: 'POST',
    headers: { 'cf-connecting-ip': ip, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

describe('write endpoints are rate limited', () => {
  it('refuses a flood of garden creates with 429 and a Retry-After', async () => {
    const ip = '77.0.0.1'
    let sawLimit: Response | undefined
    for (let n = 0; n < 20 && !sawLimit; n++) {
      const res = await post('/api/garden', ip, { note: 'x' })
      if (res.status === 429) sawLimit = res
    }
    expect(sawLimit, 'never hit the limit in 20 attempts').toBeDefined()
    expect(sawLimit!.headers.get('retry-after')).toBe('60')
    expect((await sawLimit!.json<{ error: string }>()).error).toBe('RATE_LIMITED')
  })

  it('one flooding caller does not lock out everyone else', async () => {
    for (let n = 0; n < 20; n++) await post('/api/garden', '77.0.0.2', { note: 'x' })
    // A different IP must still be served rather than sharing the exhausted budget.
    const other = await post('/api/garden', '77.0.0.3', { note: 'x' })
    expect(other.status).not.toBe(429)
  })

  it('watering has its own budget, so creating does not exhaust it', async () => {
    const ip = '77.0.0.4'
    for (let n = 0; n < 20; n++) await post('/api/garden', ip, { note: 'x' })
    const water = await post('/api/garden/does-not-exist/water', ip)
    expect(water.status).not.toBe(429)
  })
})
