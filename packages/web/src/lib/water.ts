/*
 * Watering a garden: the recipient's one-tap answer.
 *
 * The count is anonymous and lives on its own route because the garden itself is immutable and
 * cached for a year (see the API's water handlers). Whether *you* already watered is kept on this
 * device only — there is no identity to hang it on, and asking someone to sign in before they can
 * say "this was nice" would cost more than the gesture is worth.
 */

const KEY = 'bloomnote.watered.v1'
/** Plenty for one person's gardens, and small enough that the key can never grow unbounded. */
const REMEMBER_LIMIT = 200
const FEELING_KEY = 'bloomnote.feeling.v1'
export type Feeling = 'love' | 'comfort' | 'joy' | 'hug'
export type GardenResponse = { waters: number; feelings: Partial<Record<Feeling, number>> }

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // Private mode, disabled storage, or junk in the key. Forgetting is harmless: the button comes
    // back and the server still counts.
    return []
  }
}

export function hasWatered(id: string): boolean {
  return read().includes(id)
}

export function rememberWatered(id: string): void {
  try {
    const ids = read().filter((x) => x !== id)
    ids.push(id)
    localStorage.setItem(KEY, JSON.stringify(ids.slice(-REMEMBER_LIMIT)))
  } catch {
    // no-op
  }
}

export function rememberedFeeling(id: string): Feeling | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEELING_KEY) ?? '{}') as Record<string, unknown>
    const value = parsed[id]
    return value === 'love' || value === 'comfort' || value === 'joy' || value === 'hug' ? value : null
  } catch {
    return null
  }
}

function rememberFeeling(id: string, feeling: Feeling): void {
  try {
    const parsed = JSON.parse(localStorage.getItem(FEELING_KEY) ?? '{}') as Record<string, unknown>
    const entries = Object.entries(parsed)
      .filter(([gardenId]) => gardenId !== id)
      .slice(-(REMEMBER_LIMIT - 1))
    localStorage.setItem(FEELING_KEY, JSON.stringify(Object.fromEntries([...entries, [id, feeling]])))
  } catch {
    // Optional device memory only.
  }
}

export async function fetchGardenResponse(id: string): Promise<GardenResponse> {
  try {
    const response = await fetch(`/api/garden/${id}/response`)
    if (!response.ok) return { waters: 0, feelings: {} }
    return (await response.json()) as GardenResponse
  } catch {
    return { waters: 0, feelings: {} }
  }
}

export async function sendFeeling(id: string, feeling: Feeling): Promise<GardenResponse | null> {
  try {
    const response = await fetch(`/api/garden/${id}/feeling`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feeling }),
    })
    if (!response.ok) return null
    rememberFeeling(id, feeling)
    return (await response.json()) as GardenResponse
  } catch {
    return null
  }
}

export async function fetchResponsesBatch(ids: string[]): Promise<Record<string, GardenResponse>> {
  if (ids.length === 0) return {}
  try {
    const response = await fetch(`/api/responses?ids=${encodeURIComponent(ids.join(','))}`)
    if (!response.ok) return {}
    return ((await response.json()) as { responses?: Record<string, GardenResponse> }).responses ?? {}
  } catch {
    return {}
  }
}

/**
 * Water counts for a list of gardens, as `{ id: count }`. Missing means zero.
 *
 * One request for a whole page of cards. Fetching per card would mean a dozen round trips to show a
 * number that is decoration on most of them, and the failure mode of a slow list is worse than the
 * failure mode of no number at all — so this resolves to `{}` on any error and the cards just don't
 * mention watering.
 */
export async function fetchWatersBatch(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {}
  try {
    const r = await fetch(`/api/waters?ids=${encodeURIComponent(ids.join(','))}`)
    if (!r.ok) return {}
    const raw = ((await r.json()) as { waters?: unknown }).waters
    if (!raw || typeof raw !== 'object') return {}
    const out: Record<string, number> = {}
    for (const [id, n] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) out[id] = n
    }
    return out
  } catch {
    return {}
  }
}

/** Water it. Resolves to the new count, or null if the write failed. */
export async function sendWater(id: string): Promise<number | null> {
  try {
    const r = await fetch(`/api/garden/${id}/water`, { method: 'POST' })
    if (!r.ok) return null
    const n = ((await r.json()) as { waters?: unknown }).waters
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** "watered once" / "watered twice" / "watered 5 times" — the count as a sentence. */
export function watersLabel(n: number): string {
  if (n <= 0) return ''
  if (n === 1) return 'watered once'
  if (n === 2) return 'watered twice'
  return `watered ${n} times`
}
