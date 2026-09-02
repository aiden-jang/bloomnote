import type { Env } from './env.js'

// The short code IS the primary key; KV stores work this way. 6 chars of curated base62
// (no 0/O/1/l/I) makes a collision effectively impossible, but retry on the rare hit.
const ID_ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ID_LENGTH = 6
const MAX_COLLISION_RETRIES = 4
// Real gardens are ~2KB. Reject anything that would blow the budget.
const MAX_GARDEN_BYTES = 16 * 1024
const ID_RE = /^[A-Za-z0-9]{4,12}$/

// KV layout:
//   g:<id>               full garden JSON, immutable, may carry ownerId once claimed
//   sent:<userId>:<id>   the user's outbox, listable by prefix
//   recv:<userId>:<id>   gardens a signed-in user opened, receivedAt set
// Prefix-keyed indexes avoid read-modify-write races on a single list blob.
//
// Don't add an expirationTtl. A garden is a keepsake, so a link already sent has to keep
// working; users prune their own lists via removeFromAccount.

export interface GardenSummary {
  id: string
  from: string
  to: string
  occasion?: string
  createdAt: string
  unlockAt?: string
  swatches: string[]
  receivedAt?: string
}

function generateId(): string {
  const bytes = new Uint8Array(ID_LENGTH)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < ID_LENGTH; i++) id += ID_ALPHABET[bytes[i]! % ID_ALPHABET.length]
  return id
}

// Every renderer derives geometry from these fields: SVG height is `stemHeight + 80`, petals
// are `Array.from({length: petalCount})` indexed into `petalColors`. A flower missing one
// does not fail loudly. It computes NaN, and React only warns about a NaN attribute while
// still rendering, so you get a black smudge on the one screen this app exists for.
//
// So the shape is enforced at both doors: write rejects what can't be drawn, read repairs it,
// because gardens stored before this check are already in KV and their links have to work.

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const SHAPES = new Set(['round', 'elongated', 'bell', 'small', 'star'])
// Wider than the design prompt's ranges (petalCount 5-14, stemHeight 70-115) on purpose. This
// door only guarantees the thing is drawable. Couple the two and a prompt tweak silently
// starts rejecting writes.
const PETAL_COUNT = { min: 3, max: 20, fallback: 8 }
const STEM_HEIGHT = { min: 40, max: 160, fallback: 90 }
const FALLBACK_PETALS = ['#F2B8C6', '#F7CBD6', '#FADEE5']
const FALLBACK_CENTER = '#FFC53D'
const FALLBACK_STEM = '#7C9A6E'

const isHex = (v: unknown): v is string => typeof v === 'string' && HEX_RE.test(v)

function isCount(v: unknown, { min, max }: { min: number; max: number }): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
}

function isRenderableFlower(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const f = value as Record<string, unknown>
  return (
    Array.isArray(f.petalColors) &&
    f.petalColors.length === 3 &&
    f.petalColors.every(isHex) &&
    isHex(f.centerColor) &&
    isHex(f.stemColor) &&
    typeof f.petalShape === 'string' &&
    SHAPES.has(f.petalShape) &&
    isCount(f.petalCount, PETAL_COUNT) &&
    isCount(f.stemHeight, STEM_HEIGHT)
  )
}

function repairFlower(value: unknown): Record<string, unknown> {
  const f = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const petals = Array.isArray(f.petalColors) ? f.petalColors.filter(isHex) : []
  return {
    ...f,
    name: typeof f.name === 'string' && f.name.trim() ? f.name : 'a flower',
    meaning: typeof f.meaning === 'string' ? f.meaning : '',
    petalColors: petals.length === 3 ? petals : FALLBACK_PETALS,
    centerColor: isHex(f.centerColor) ? f.centerColor : FALLBACK_CENTER,
    stemColor: isHex(f.stemColor) ? f.stemColor : FALLBACK_STEM,
    petalShape: typeof f.petalShape === 'string' && SHAPES.has(f.petalShape) ? f.petalShape : 'round',
    petalCount: isCount(f.petalCount, PETAL_COUNT) ? f.petalCount : PETAL_COUNT.fallback,
    stemHeight: isCount(f.stemHeight, STEM_HEIGHT) ? f.stemHeight : STEM_HEIGHT.fallback,
  }
}

export function looksLikeGarden(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const g = value as Record<string, unknown>
  // Both renderers are laid out for the 3-5 the design path produces. Cap the write at 5 so a
  // crafted payload can't store a garden that overlaps itself.
  if (!Array.isArray(g.flowers) || g.flowers.length === 0 || g.flowers.length > 5) return false
  if (!g.flowers.every(isRenderableFlower)) return false
  // A reply carries the garden it answers. The composer caps depth at 1, so one level covers it.
  if (g.previous !== undefined && !looksLikeGarden(g.previous)) return false
  return true
}

export function repairGarden(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value
  const g = value as Record<string, unknown>
  if (!Array.isArray(g.flowers)) return value
  const out: Record<string, unknown> = { ...g, flowers: g.flowers.map(repairFlower) }
  if (g.previous && typeof g.previous === 'object') out.previous = repairGarden(g.previous)
  return out
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function summarize(id: string, garden: Record<string, unknown>): GardenSummary {
  const flowers = Array.isArray(garden.flowers) ? garden.flowers : []
  const swatches: string[] = []
  for (const f of flowers.slice(0, 5)) {
    const pc = (f as Record<string, unknown> | null)?.petalColors
    const first = Array.isArray(pc) ? pc[0] : undefined
    if (typeof first === 'string') swatches.push(first)
  }
  const summary: GardenSummary = {
    id,
    from: str(garden.from),
    to: str(garden.to),
    createdAt: str(garden.createdAt) || new Date().toISOString(),
    swatches,
  }
  if (typeof garden.occasion === 'string') summary.occasion = garden.occasion
  if (typeof garden.unlockAt === 'string') summary.unlockAt = garden.unlockAt
  return summary
}

/* Index entries carry their summary twice, in the value and in the key's list metadata. The
   metadata copy is what makes a listing one read instead of one read per garden. */
const KV_METADATA_LIMIT = 1024

async function putIndex(env: Env, key: string, summary: GardenSummary): Promise<void> {
  const body = JSON.stringify(summary)
  const fits = new TextEncoder().encode(body).length <= KV_METADATA_LIMIT
  await env.GARDENS.put(key, body, fits ? { metadata: summary } : {})
}

/* Rendered in the sender's browser, not here: the Worker has no canvas, and the sender is
   already holding the garden it needs to draw. */
const MAX_OG_BYTES = 400 * 1024

export type OgResult = { ok: true } | { ok: false; status: 400 | 409 | 413; message: string }

export async function putOgImage(env: Env, id: string, bytes: ArrayBuffer): Promise<OgResult> {
  if (!ID_RE.test(id)) return { ok: false, status: 400, message: 'Bad id.' }
  if (bytes.byteLength === 0) return { ok: false, status: 400, message: 'Empty image.' }
  if (bytes.byteLength > MAX_OG_BYTES) {
    return { ok: false, status: 413, message: `Image exceeds ${MAX_OG_BYTES} bytes.` }
  }
  // A PNG always starts with these eight bytes. Cheap, and it stops the store being used as a
  // dumping ground for blobs that would then be served with an image content type.
  const head = new Uint8Array(bytes.slice(0, 8))
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (!PNG.every((b, i) => head[i] === b)) return { ok: false, status: 400, message: 'Not a PNG.' }
  // The garden has to exist, so an image cannot be parked against an id nobody has claimed.
  if ((await env.GARDENS.get(`g:${id}`)) === null)
    return { ok: false, status: 400, message: 'No such garden.' }
  if ((await env.GARDENS.get(`og:${id}`, 'stream')) !== null) {
    return { ok: false, status: 409, message: 'Already has an image.' }
  }
  await env.GARDENS.put(`og:${id}`, bytes)
  return { ok: true }
}

export async function readOgImage(env: Env, id: string): Promise<ArrayBuffer | null> {
  if (!ID_RE.test(id)) return null
  return env.GARDENS.get(`og:${id}`, 'arrayBuffer')
}

const MAX_WATERS = 99
export const FEELINGS = ['love', 'comfort', 'joy', 'hug'] as const
export type Feeling = (typeof FEELINGS)[number]
export type GardenResponse = { waters: number; feelings: Partial<Record<Feeling, number>> }

function parseResponse(raw: string | null): GardenResponse {
  if (raw === null) return { waters: 0, feelings: {} }
  const legacy = Number.parseInt(raw, 10)
  if (/^\d+$/.test(raw) && Number.isFinite(legacy)) {
    return { waters: Math.min(MAX_WATERS, Math.max(0, legacy)), feelings: {} }
  }
  try {
    const value = JSON.parse(raw) as Partial<GardenResponse>
    const feelings: Partial<Record<Feeling, number>> = {}
    for (const feeling of FEELINGS) {
      const count = value.feelings?.[feeling]
      if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
        feelings[feeling] = Math.min(MAX_WATERS, Math.floor(count))
      }
    }
    return {
      waters:
        typeof value.waters === 'number' ? Math.min(MAX_WATERS, Math.max(0, Math.floor(value.waters))) : 0,
      feelings,
    }
  } catch {
    return { waters: 0, feelings: {} }
  }
}

export async function readGardenResponse(env: Env, id: string): Promise<GardenResponse> {
  if (!ID_RE.test(id)) return { waters: 0, feelings: {} }
  return parseResponse(await env.GARDENS.get(`water:${id}`))
}

export type WaterResult = { ok: true; waters: number } | { ok: false; status: 400; message: string }

export async function waterGarden(env: Env, id: string): Promise<WaterResult> {
  if (!ID_RE.test(id)) return { ok: false, status: 400, message: 'Bad id.' }
  // The garden has to exist, so nobody can park a counter against an unclaimed id.
  if ((await env.GARDENS.get(`g:${id}`)) === null) {
    return { ok: false, status: 400, message: 'No such garden.' }
  }
  const response = await readGardenResponse(env, id)
  const current = response.waters
  // At the cap, answer without writing. Math.min alone clamps the number but still put()s it, so
  // a loop against one garden was an unbounded stream of KV writes. Writes are the scarce quota
  // here, shared with garden creation, and exhausting it stops anyone making a new garden.
  if (current >= MAX_WATERS) return { ok: true, waters: MAX_WATERS }
  const next = current + 1
  await env.GARDENS.put(`water:${id}`, JSON.stringify({ ...response, waters: next }))
  return { ok: true, waters: next }
}

export async function readWaters(env: Env, id: string): Promise<number> {
  return (await readGardenResponse(env, id)).waters
}

export async function feelGarden(
  env: Env,
  id: string,
  feeling: string,
): Promise<{ ok: true; response: GardenResponse } | { ok: false; status: 400; message: string }> {
  if (!ID_RE.test(id) || !FEELINGS.includes(feeling as Feeling)) {
    return { ok: false, status: 400, message: 'Bad response.' }
  }
  if ((await env.GARDENS.get(`g:${id}`)) === null) {
    return { ok: false, status: 400, message: 'No such garden.' }
  }
  const response = await readGardenResponse(env, id)
  const kind = feeling as Feeling
  if ((response.feelings[kind] ?? 0) >= MAX_WATERS) return { ok: true, response }
  response.feelings[kind] = Math.min(MAX_WATERS, (response.feelings[kind] ?? 0) + 1)
  await env.GARDENS.put(`water:${id}`, JSON.stringify(response))
  return { ok: true, response }
}

export async function readResponsesBatch(env: Env, ids: string[]): Promise<Record<string, GardenResponse>> {
  const wanted = [...new Set(ids.filter((id) => ID_RE.test(id)))].slice(0, MAX_WATER_LOOKUP)
  const responses = await Promise.all(wanted.map((id) => readGardenResponse(env, id)))
  const out: Record<string, GardenResponse> = {}
  wanted.forEach((id, index) => {
    const response = responses[index]!
    if (response.waters > 0 || Object.keys(response.feelings).length > 0) out[id] = response
  })
  return out
}

/* Batched: the "your gardens" list would otherwise cost one read per garden. */
const MAX_WATER_LOOKUP = 40

export async function readWatersBatch(env: Env, ids: string[]): Promise<Record<string, number>> {
  const wanted = [...new Set(ids.filter((id) => ID_RE.test(id)))].slice(0, MAX_WATER_LOOKUP)
  const counts = await Promise.all(wanted.map((id) => readWaters(env, id)))
  const out: Record<string, number> = {}
  wanted.forEach((id, i) => {
    const n = counts[i] ?? 0
    if (n > 0) out[id] = n
  })
  return out
}

export type CreateResult = { ok: true; id: string } | { ok: false; status: 400 | 413 | 500; message: string }

export async function createGarden(env: Env, garden: unknown, ownerId?: string): Promise<CreateResult> {
  if (!looksLikeGarden(garden))
    return { ok: false, status: 400, message: 'Body does not look like a garden.' }
  // Shallow-copy so stamping ownerId never mutates the caller's object.
  const obj = { ...(garden as Record<string, unknown>) }
  if (ownerId) obj.ownerId = ownerId
  const serialized = JSON.stringify(obj)
  if (serialized.length > MAX_GARDEN_BYTES) {
    return { ok: false, status: 413, message: `Garden exceeds ${MAX_GARDEN_BYTES} bytes.` }
  }
  for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
    const id = generateId()
    if ((await env.GARDENS.get(`g:${id}`)) === null) {
      await env.GARDENS.put(`g:${id}`, serialized)
      if (ownerId) await putIndex(env, `sent:${ownerId}:${id}`, summarize(id, obj))
      return { ok: true, id }
    }
  }
  return { ok: false, status: 500, message: 'Could not generate a unique id. Try again.' }
}

export async function readGarden(env: Env, id: string): Promise<unknown | null> {
  if (!ID_RE.test(id)) return null
  const raw = await env.GARDENS.get(`g:${id}`)
  return raw === null ? null : repairGarden(JSON.parse(raw) as unknown)
}

export async function recordReceived(env: Env, userId: string, id: string): Promise<boolean> {
  if (!ID_RE.test(id)) return false
  const raw = await env.GARDENS.get(`g:${id}`)
  if (raw === null) return false
  const garden = JSON.parse(raw) as Record<string, unknown>
  // Your own garden isn't "received".
  if (garden.ownerId === userId) return false
  await putIndex(env, `recv:${userId}:${id}`, {
    ...summarize(id, garden),
    receivedAt: new Date().toISOString(),
  })
  return true
}

/* The garden itself (`g:<id>`) is kept, so any link already sent keeps working. */
export async function removeFromAccount(env: Env, userId: string, id: string): Promise<void> {
  if (!ID_RE.test(id)) return
  await Promise.all([env.GARDENS.delete(`sent:${userId}:${id}`), env.GARDENS.delete(`recv:${userId}:${id}`)])
}

/* How many pre-metadata entries one listing may fall back to fetching. listMine calls this
   twice, so the worst case is double this number of subrequests. */
const LEGACY_FETCH_LIMIT = 10

async function listByPrefix(env: Env, prefix: string): Promise<GardenSummary[]> {
  const listed = await env.GARDENS.list<GardenSummary>({ prefix })
  const out: GardenSummary[] = []
  const legacy: string[] = []
  for (const k of listed.keys) {
    if (k.metadata) out.push(k.metadata)
    else legacy.push(k.name)
  }

  // Entries written before summaries moved into metadata. Fetch a bounded number and write the
  // metadata back, so each costs a subrequest once and the list gets cheaper every open.
  // Best-effort: a failed heal just means it is fetched again next time.
  if (legacy.length > 0) {
    const healed = await Promise.all(
      legacy.slice(0, LEGACY_FETCH_LIMIT).map(async (name) => {
        const raw = await env.GARDENS.get(name)
        if (raw === null) return null
        try {
          const summary = JSON.parse(raw) as GardenSummary
          await putIndex(env, name, summary).catch(() => undefined)
          return summary
        } catch {
          return null
        }
      }),
    )
    for (const h of healed) if (h) out.push(h)
  }

  out.sort((a, b) => (b.receivedAt ?? b.createdAt).localeCompare(a.receivedAt ?? a.createdAt))
  return out
}

export async function listMine(
  env: Env,
  userId: string,
): Promise<{ sent: GardenSummary[]; received: GardenSummary[] }> {
  const [sent, received] = await Promise.all([
    listByPrefix(env, `sent:${userId}:`),
    listByPrefix(env, `recv:${userId}:`),
  ])
  return { sent, received }
}

export async function claimGardens(env: Env, userId: string, ids: string[]): Promise<number> {
  let claimed = 0
  for (const id of ids.slice(0, 100)) {
    if (!ID_RE.test(id)) continue
    const raw = await env.GARDENS.get(`g:${id}`)
    if (raw === null) continue
    const garden = JSON.parse(raw) as Record<string, unknown>
    if (garden.ownerId) continue
    garden.ownerId = userId
    await env.GARDENS.put(`g:${id}`, JSON.stringify(garden))
    await putIndex(env, `sent:${userId}:${id}`, summarize(id, garden))
    claimed++
  }
  return claimed
}
