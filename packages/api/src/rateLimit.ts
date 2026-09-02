import type { Env } from './env.js'

/** Fails OPEN. KV is not atomic, so counts drift at the margin, and this is a courtesy limit
    rather than a security boundary. */
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

export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}
