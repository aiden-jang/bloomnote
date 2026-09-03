import type { Env } from './env.js'

export interface RateLimitResult {
  ok: boolean
  retryAfter: number
  message: string
}

const OK: RateLimitResult = { ok: true, retryAfter: 0, message: '' }

/** Fails OPEN: an abuse limit is not worth taking the app down for. */
export async function checkRate(
  env: Env,
  bucket: string,
  ip: string,
  perMinute: number,
): Promise<RateLimitResult> {
  try {
    // One instance per IP, so limiting one caller never serializes anyone else's requests.
    const counters = env.COUNTERS.get(env.COUNTERS.idFromName(ip))
    const result = await counters.bump(bucket, perMinute, 60)
    return result.ok
      ? OK
      : { ok: false, retryAfter: result.retryAfter, message: 'Slow down a moment, then try again.' }
  } catch {
    return OK
  }
}

export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip') ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
}
