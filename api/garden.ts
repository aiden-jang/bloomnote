// Garden short-URL endpoint.
//
// Replaces the old TinyURL proxy with a self-hosted KV-backed
// shortener at our own domain. Two reasons this is better:
//
//   1. No ads on the redirect (TinyURL injects an interstitial for
//      some traffic patterns — bad first impression for a card app).
//   2. Branded URLs. Recipients see `blossom.aidenjang.com/g/abc123`
//      instead of `tinyurl.com/2x9y`. Trust signal.
//
// The data model is intentionally trivial: a single Redis key
// (`g:<short_id>`) mapping to the JSON-stringified GardenData. No
// relational schema, no separate `id` column — the short code IS
// the primary key. KV stores work this way.
//
// Two HTTP methods on one route:
//
//   POST /api/garden          → create. Body is the GardenData JSON.
//                                Returns { id, shareUrl, remixUrl }.
//   GET  /api/garden?id=xxx   → read. Returns { garden } or 404.
//
// Falls back gracefully when Upstash credentials are missing — the
// frontend already knows how to use legacy long-encoded URLs, so a
// dev environment without an Upstash account still works (just with
// uglier URLs). This is the kind of progressive enhancement that
// keeps the developer experience friction-free.

import { Redis } from '@upstash/redis'
import { getClientIp, rateLimit } from './_lib/rateLimit'

export const config = { runtime: 'edge' }

// Lazily initialized so we don't construct a Redis client on cold
// start if the env vars aren't set — that would let "client cannot
// be initialized" errors mask the real "missing creds" diagnosis.
let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

// 6 chars of base62 = 62^6 ≈ 56 billion possible IDs. For a portfolio
// project that might see a few thousand gardens lifetime, the
// collision probability is effectively zero — but we still retry on
// SETNX failure as defense-in-depth.
//
// We deliberately exclude visually ambiguous characters (0/O, 1/l/I)
// so a recipient typing a URL from memory has a fighting chance.
const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ID_LENGTH = 6
const MAX_COLLISION_RETRIES = 4

function generateId(): string {
  // crypto.getRandomValues works in Edge runtime (Web Crypto API).
  // We pull more bytes than needed and modulo into the alphabet —
  // technically introduces ~negligible bias but it's irrelevant at
  // this alphabet size and key-space.
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[bytes[i] % ID_ALPHABET.length]
  }
  return id
}

// Per-IP request budget for create. Looser than the model endpoint
// because writes here are cheap (one Redis SETNX, no LLM call). The
// shared rateLimit() helper is Redis-backed so this survives cold
// starts — see api/_lib/rateLimit.ts.
const CREATE_LIMIT_PER_MINUTE = 12

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function jsonOk(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Aggressive cache for the GET case — once a garden is created,
      // its contents are immutable, so any cache can hold it forever.
      // CDN respects this header; the browser does too. Saves Redis
      // commands on viral links.
      ...(body && typeof body === 'object' && 'garden' in body
        ? { 'Cache-Control': 'public, max-age=31536000, immutable' }
        : {}),
    },
  })
}

// Cheap structural validation. The endpoint accepts whatever the client
// sends, but we want to reject (a) huge payloads that would blow up
// our storage budget and (b) anything that isn't shaped like a garden.
const MAX_GARDEN_BYTES = 16 * 1024  // 16 KB. Real gardens are ~2KB.

function looksLikeGarden(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const g = value as Record<string, unknown>
  return Array.isArray(g.flowers) && g.flowers.length > 0 && g.flowers.length <= 10
}

export default async function handler(req: Request): Promise<Response> {
  const redis = getRedis()
  if (!redis) {
    return jsonError(
      'Short URLs disabled — UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN not set. Falling back to encoded URLs.',
      503,
    )
  }

  if (req.method === 'GET') {
    return handleGet(req, redis)
  }
  if (req.method === 'POST') {
    return handlePost(req, redis)
  }
  return new Response('Method not allowed', { status: 405 })
}

async function handleGet(req: Request, redis: Redis): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id')
  if (!id || !/^[A-Za-z0-9]{4,12}$/.test(id)) {
    return jsonError('Missing or malformed id.', 400)
  }

  // Upstash auto-parses JSON values when they're stored as strings.
  // We get either a parsed object or null (key not found).
  const garden = await redis.get(`g:${id}`)
  if (garden === null) {
    return jsonError('Garden not found.', 404)
  }

  return jsonOk({ garden })
}

async function handlePost(req: Request, redis: Redis): Promise<Response> {
  const rl = await rateLimit('garden', getClientIp(req), CREATE_LIMIT_PER_MINUTE)
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `Rate limited. Try again in ${rl.retryAfter}s.` }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(rl.retryAfter),
        },
      },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON.', 400)
  }

  if (!looksLikeGarden(body)) {
    return jsonError('Body does not look like a garden.', 400)
  }

  const serialized = JSON.stringify(body)
  if (serialized.length > MAX_GARDEN_BYTES) {
    return jsonError(`Garden exceeds ${MAX_GARDEN_BYTES} bytes.`, 413)
  }

  // SETNX-style insert: only write if the key is unused. On collision
  // (vanishingly rare at 6 chars base62) we regenerate and retry a
  // few times before giving up.
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const id = generateId()
    // `nx: true` is Redis SETNX — succeeds only if the key doesn't exist.
    // Returns "OK" on success, null on collision.
    const result = await redis.set(`g:${id}`, serialized, { nx: true })
    if (result === 'OK') {
      return jsonOk({ id })
    }
  }

  // Practically unreachable. If we ever hit it, our random source is
  // broken or the keyspace is exhausted — either way it's an emergency.
  return jsonError('Could not generate a unique id. Try again.', 500)
}
