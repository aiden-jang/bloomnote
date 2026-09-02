// This shape is mirrored by the model's tool schema in api/src/prompt.ts. A new petal shape or
// colour field has to be added in both places or the model sends something this can't draw.

export type PetalShape = 'round' | 'elongated' | 'bell' | 'small' | 'star'

export interface FlowerSpec {
  name: string
  meaning: string
  petalColors: [string, string, string]
  centerColor: string
  stemColor: string
  petalShape: PetalShape
  petalCount: number
  stemHeight: number
}

/** Every optional field is optional for the same reason: gardens written before that field
    existed are still in KV and still have to open. */
export interface GardenData {
  flowers: FlowerSpec[]
  bouquetNote: string
  message: string
  secret?: string | undefined
  from: string
  to?: string | undefined
  createdAt?: string | undefined
  /** ISO 8601. Until this moment the recipient sees a countdown instead of the garden, compared
      against their own clock. */
  unlockAt?: string | undefined
  occasion?: string | undefined
  mood?: string | undefined
  /** The garden this one replies to. Depth-capped at 1, so a `previous` never has its own. */
  previous?: GardenData | undefined
}

const SHAPES: PetalShape[] = ['round', 'elongated', 'bell', 'small', 'star']
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

/** Substitute a drawable value for any flower field that would break the render. The API
    validates on write, but gardens stored before that check are already in KV. */
export function drawableFlower(f: FlowerSpec): FlowerSpec {
  const petals = Array.isArray(f.petalColors) ? f.petalColors.filter(isHex) : []
  return {
    ...f,
    name: typeof f.name === 'string' && f.name.trim() ? f.name : 'a flower',
    meaning: typeof f.meaning === 'string' ? f.meaning : '',
    petalColors: petals.length > 0 ? (petals as [string, string, string]) : ['#F2B8C6', '#F7CBD6', '#FADEE5'],
    centerColor: isHex(f.centerColor) ? f.centerColor : '#FFC53D',
    stemColor: isHex(f.stemColor) ? f.stemColor : '#7C9A6E',
    petalShape: SHAPES.includes(f.petalShape) ? f.petalShape : 'round',
    petalCount: Number.isInteger(f.petalCount) && f.petalCount > 0 && f.petalCount <= 20 ? f.petalCount : 8,
    stemHeight: Number.isFinite(f.stemHeight) && f.stemHeight > 0 ? f.stemHeight : 90,
  }
}

export function drawableGarden(g: GardenData): GardenData {
  const out: GardenData = {
    ...g,
    flowers: Array.isArray(g.flowers) ? g.flowers.map(drawableFlower) : [],
  }
  if (g.previous) out.previous = drawableGarden(g.previous)
  return out
}

// Gardens live in Workers KV under a 6-character id. `/g/<id>` and `/r/<id>` are two views of
// one record, and nothing is URL-encoded, so a link can't be pulled apart or forged.

/** Origin root. Path routing (/g/, /r/) rules out deploying under a subdirectory. */
function buildAppUrl(): string {
  return window.location.origin
}

/** 57 characters: base62 minus 0/O and 1/l/I. Mirrors gardens.ts on the server, change both. */
const SHORT_ID_PATTERN = /^[A-HJ-NP-Za-km-z2-9]{6}$/

export function isShortId(value: string): boolean {
  return SHORT_ID_PATTERN.test(value)
}

/** Null on any failure. The composer surfaces that: a share link that half-works is worse. */
export async function createShortGarden(data: GardenData, signal?: AbortSignal): Promise<string | null> {
  try {
    const resp = await fetch('/api/garden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: signal ?? null,
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as { id?: string }
    return typeof json.id === 'string' ? json.id : null
  } catch {
    return null
  }
}

/** Served immutable for a year, so a repeat open never leaves the browser. */
export async function fetchGarden(id: string, signal?: AbortSignal): Promise<GardenData | null> {
  const resp = await fetch(`/api/garden?id=${encodeURIComponent(id)}`, {
    signal: signal ?? null,
  })
  // A real "gone" (bad id, deleted) is a 404 and returns null. Anything else throws, so the
  // caller can offer a retry instead of falsely claiming the link expired.
  if (resp.status === 404) return null
  if (!resp.ok) throw new Error(`garden fetch failed: ${resp.status}`)
  const json = (await resp.json()) as { garden?: unknown }
  // The single untrusted boundary in the app. Everything downstream computes geometry straight
  // from these fields, so normalizing here means a missing field costs a default, not a broken gift.
  if (!json.garden) return null
  return drawableGarden(json.garden as GardenData)
}

export function buildShareUrl(id: string): string {
  return `${buildAppUrl()}/g/${id}`
}

export function buildRemixUrl(id: string): string {
  return `${buildAppUrl()}/r/${id}`
}
