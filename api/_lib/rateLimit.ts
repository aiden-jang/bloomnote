// Redis-backed per-IP rate limiter, shared by all API endpoints.
//
// The previous implementation was an in-memory `Map<ip, { count, resetAt }>`,
// which had a real correctness problem: Edge function cold starts wipe the
// Map. Two requests landing on different cold instances would both see
// "first request, count=1, allowed" — effectively no rate limit. With
// real traffic, you'd get N parallel cold instances each granting the
// full budget independently.
//
// Redis fixes this. INCR is atomic across all caller instances, and
// EXPIRE applied on the first increment gives a sliding 60-second
// window keyed off when the bucket opened. Survives cold starts, scales
// to any number of edge regions, and uses ~2 commands per request.
//
// The shape mirrors the old in-memory function so call sites barely
// change — just `await` the call now.

import { getRedis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  /** Seconds until the bucket resets; 0 when allowed. */
  retryAfter: number
}

/**
 * Increment a per-key request counter and check it against `limit`.
 * Returns whether this request is allowed and how long until the
 * caller can retry on rate-limit hits.
 *
 * Bucket key is namespaced by `scope` so different endpoints have
 * independent budgets (e.g. design-garden allows 8/min while the
 * cheap garden POST allows 12/min). Without that, a hot share-link
 * UI would exhaust the model-call budget.
 *
 * Failure mode: if Redis is unreachable (creds missing or network),
 * we fall open — `allowed: true`. The product is fine without rate
 * limiting; it's a soft defense, not a security boundary. Failing
 * closed would mean a Redis outage takes down the whole API.
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  limit: number,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const redis = getRedis()
  if (!redis) return { allowed: true, retryAfter: 0 }

  const key = `rl:${scope}:${identifier}`
  try {
    // INCR returns the new value. On the first increment of a key,
    // we also set the expiry — Redis doesn't auto-expire keys unless
    // we ask it to. We could use `SET key 1 EX 60 NX` then INCR but
    // that's two round-trips; INCR + conditional EXPIRE is one in the
    // common case.
    const count = await redis.incr(key)
    if (count === 1) {
      // EXPIRE is fire-and-forget — if it fails we still rate-limit,
      // the key just lives forever (which Upstash's eviction handles
      // eventually via LRU on free tier).
      await redis.expire(key, windowSeconds)
    }
    if (count > limit) {
      // TTL returns seconds remaining on the key. -1 means no expiry
      // was set (shouldn't happen given the EXPIRE above) and -2 means
      // the key already expired between INCR and TTL (race). In both
      // edge cases we just say "retry in a few seconds" rather than
      // doing something fancier.
      const ttl = await redis.ttl(key)
      return { allowed: false, retryAfter: ttl > 0 ? ttl : 5 }
    }
    return { allowed: true, retryAfter: 0 }
  } catch {
    // Fail open. See the failure-mode comment above.
    return { allowed: true, retryAfter: 0 }
  }
}

/**
 * Pull the originating client IP from Vercel's forwarded headers.
 * Picks the FIRST hop — subsequent values are proxies, not the client.
 *
 * Lives here so both endpoints get the same identifier strategy
 * (otherwise design-garden and garden could end up using different
 * IP-extraction logic and rate-limit the wrong people).
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  return fwd.split(',')[0]?.trim() || 'unknown'
}
