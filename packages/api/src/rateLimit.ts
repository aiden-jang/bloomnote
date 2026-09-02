import type { Env } from './env.js'

/**
 * Per-IP rate limiting, counted in KV.
 *
 * Fails OPEN. KV is not atomic, so counts drift a little under a burst, and a KV outage would
 * otherwise take the whole app down. These guards keep one script from filling the database;
 * they are not a security boundary, and nothing here should be relied on as one.
 */
export interface RateLimitResult {
  ok: boolean
  retryAfter: number
  message: string
}

const OK: RateLimitResult = { ok: true, retryAfter: 0, message: '' }

export async function checkRate(
  env: Env,
  bucket: string,
  ip: string,
  perMinute: number,
): Promise<RateLimitResult> {
  try {
    const minute = Math.floor(Date.now() / 60_000)
    const key = `rl:${bucket}:${ip}:${minute}`
    const count = (Number(await env.GARDENS.get(key)) || 0) + 1
    // 120s, not 60s: a key written at :59 still has to cover the rest of its minute.
    await env.GARDENS.put(key, String(count), { expirationTtl: 120 })
    if (count > perMinute) {
      return { ok: false, retryAfter: 60, message: 'Slow down a moment, then try again.' }
    }
    return OK
  } catch {
    return OK
  }
}

/** Client IP, as Cloudflare reports it. */
export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}
