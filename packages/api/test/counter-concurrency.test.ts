import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { DAILY_CAP, checkBudget } from '../src/designGarden.js'
import { checkRate } from '../src/rateLimit.js'

/**
 * Send these in parallel or they prove nothing: on KV these counts were read-modify-write, and
 * 40 parallel requests passed a limit of 5 while sequential callers were limited correctly.
 */
describe('counters under parallel load', () => {
  it('holds a per-IP limit against a parallel burst', async () => {
    const limit = 5
    const results = await Promise.all(
      Array.from({ length: 40 }, () => checkRate(env, 'probe', '203.0.113.7', limit)),
    )
    expect(results.filter((r) => r.ok).length).toBe(limit)
  })

  it('holds the daily spend cap across parallel callers', async () => {
    // Distinct IPs, so the per-IP limit never trips and only the global cap can refuse them.
    const results = await Promise.all(
      Array.from({ length: DAILY_CAP + 25 }, (_, n) => checkBudget(env, `198.51.100.${n}`)),
    )
    expect(results.filter((r) => r.ok).length).toBe(DAILY_CAP)
  })
})
