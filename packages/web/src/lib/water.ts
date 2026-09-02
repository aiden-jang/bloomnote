const KEY = 'bloomnote.watered.v1'
/** Plenty for one person's gardens, and small enough that the key can never grow unbounded. */
const REMEMBER_LIMIT = 200
const FEELING_KEY = 'bloomnote.feeling.v1'
export type Feeling = 'love' | 'comfort' | 'joy' | 'hug'
export type GardenResponse = { waters: number; feelings: Partial<Record<Feeling, number>> }

/**
 * Write, or don't.
 *
 * Private mode and disabled storage both throw here, and forgetting is harmless: the button comes
 * back and the server still holds the real count.
 */
function remember(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // See above.
  }
}

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    // Junk in the key reads as nothing watered, which is the safe direction.
    return []
  }
}

export function hasWatered(id: string): boolean {
  return read().includes(id)
}

export function rememberWatered(id: string): void {
  const ids = read().filter((x) => x !== id)
  ids.push(id)
  remember(KEY, ids.slice(-REMEMBER_LIMIT))
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
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(localStorage.getItem(FEELING_KEY) ?? '{}') as Record<string, unknown>
  } catch {
    // A junk key reads as no memory at all, which is the same as never having answered.
  }
  const entries = Object.entries(parsed)
    .filter(([gardenId]) => gardenId !== id)
    .slice(-(REMEMBER_LIMIT - 1))
  remember(FEELING_KEY, Object.fromEntries([...entries, [id, feeling]]))
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

export function watersLabel(n: number): string {
  if (n <= 0) return ''
  if (n === 1) return 'watered once'
  if (n === 2) return 'watered twice'
  return `watered ${n} times`
}
