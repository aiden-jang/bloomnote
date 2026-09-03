import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { checkRate, clientIp } from '../src/rateLimit.js'

describe('per-IP rate limiting', () => {
  it('allows traffic up to the limit and refuses past it', async () => {
    const ip = `1.1.1.${Math.floor(Math.random() * 250)}`
    for (let n = 0; n < 3; n++) {
      expect((await checkRate(env, 'test', ip, 3)).ok, `call ${n + 1}`).toBe(true)
    }
    const over = await checkRate(env, 'test', ip, 3)
    expect(over.ok).toBe(false)
    // Seconds until the window rolls, so it moves with the clock rather than being a constant.
    expect(over.retryAfter).toBeGreaterThan(0)
    expect(over.retryAfter).toBeLessThanOrEqual(60)
    expect(over.message).toMatch(/slow down/i)
  })

  it('counts each caller separately', async () => {
    const stamp = Math.random().toString(36).slice(2)
    await checkRate(env, `sep-${stamp}`, '9.9.9.1', 1)
    // The first caller is now at its limit; a different IP must be unaffected.
    expect((await checkRate(env, `sep-${stamp}`, '9.9.9.2', 1)).ok).toBe(true)
    expect((await checkRate(env, `sep-${stamp}`, '9.9.9.1', 1)).ok).toBe(false)
  })

  it('counts each bucket separately, so one endpoint cannot exhaust another', async () => {
    const ip = `2.2.2.${Math.floor(Math.random() * 250)}`
    await checkRate(env, 'bucket-a', ip, 1)
    expect((await checkRate(env, 'bucket-b', ip, 1)).ok).toBe(true)
  })

  it('fails open, because an unreachable counter must not take the app down', async () => {
    const broken = {
      COUNTERS: {
        idFromName: () => {
          throw new Error('counter unreachable')
        },
      },
    } as unknown as typeof env
    expect((await checkRate(broken, 'test', '3.3.3.3', 1)).ok).toBe(true)
  })

  it('reads the IP Cloudflare reports, falling back sensibly', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': '5.5.5.5' }))).toBe('5.5.5.5')
    expect(clientIp(new Headers({ 'x-forwarded-for': '6.6.6.6, 7.7.7.7' }))).toBe('6.6.6.6')
    expect(clientIp(new Headers())).toBe('unknown')
  })
})
