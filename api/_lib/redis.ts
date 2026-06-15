// Shared Upstash Redis client. Four endpoints used to define their
// own lazy getRedis() with identical bodies; consolidating them here
// keeps the env-var contract in one place and makes it harder to drift
// (e.g. add token rotation logic once instead of four times).

import { Redis } from '@upstash/redis'

let cached: Redis | null = null

export function getRedis(): Redis | null {
  if (cached) return cached
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  cached = new Redis({ url, token })
  return cached
}
