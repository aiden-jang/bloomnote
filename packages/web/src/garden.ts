// The garden domain model.
//
// This shape is mirrored by the model's tool schema in api/src/prompt.ts, so a new petal shape or
// colour field has to be added in both places or the model will send something this can't draw.

export type PetalShape = 'round' | 'elongated' | 'bell' | 'small' | 'star'

/** A single AI-designed flower. Renders without any preset table. */
export interface FlowerSpec {
  /** A real flower species, plain: "Rose", "Sunflower", "Lavender". */
  name: string
  /** One-sentence note about what this flower represents for the recipient. */
  meaning: string
  /** Exactly 3 hex colors for the petal gradient (outer → inner). */
  petalColors: [string, string, string]
  /** Hex color for the flower center disk. */
  centerColor: string
  /** Hex color for the stem (some green shade). */
  stemColor: string
  petalShape: PetalShape
  /** 5–14, drives the petal count drawn around the center. */
  petalCount: number
  /** 70–115 pixels, drives stem length. */
  stemHeight: number
}

/**
 * A stored garden.
 *
 * Every optional field is optional for the same reason: gardens written before that field existed
 * are immutable and cached for a year, so each one has to decode and render without it. Adding a
 * required field here silently breaks every garden already in the wild.
 */
export interface GardenData {
  flowers: FlowerSpec[]
  /** One or two sentences about the bouquet as a whole, AI-written. */
  bouquetNote: string
  /** The sender's own message. */
  message: string
  /** An optional sender-written aside the recipient chooses to reveal. */
  secret?: string | undefined
  from: string
  to?: string | undefined
  /** ISO 8601. Drives the "grown on …" line, which is simply omitted when absent. */
  createdAt?: string | undefined
  /**
   * ISO 8601. Until this moment the recipient sees a countdown instead of the garden.
   *
   * Compared against the recipient's own clock, so someone determined can set their device forward
   * and open it early. That is fine: this is choreography for a moment, not a security boundary,
   * and the cost of treating it as one would be a server round trip on every load.
   */
  unlockAt?: string | undefined
  /** Mirrors OCCASIONS in src/lib/occasions.ts. Drives the sky gradient; falls back to the default. */
  occasion?: string | undefined
  /** Mirrors MOODS in src/lib/moods.ts. Drives the garden's subtle animated atmosphere. */
  mood?: string | undefined
  /**
   * The garden this one replies to. Depth-capped at 1 — a `previous` never has its own — so the
   * record stays bounded no matter how long the back-and-forth runs.
   */
  previous?: GardenData | undefined
}

// --- Making a stored garden drawable ------------------------------------

const SHAPES: PetalShape[] = ['round', 'elongated', 'bell', 'small', 'star']
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v)

/**
 * Substitute a drawable value for any flower field that would break the render.
 *
 * The API validates on write and repairs on read, so in principle nothing reaches here
 * malformed. It is guarded anyway because a garden response is served `immutable` for a year:
 * a recipient who opened a broken garden before the repair shipped keeps being handed the broken
 * copy out of their own browser cache, where no server fix can reach them. This runs after that
 * cache, so it can.
 *
 * Every failure it prevents is silent rather than loud. `stemHeight + 80` gives NaN and React
 * only *warns* about a NaN attribute; a missing color falls through to SVG's own defaults, which
 * are `fill: black` and `stroke: none`. Together they render a black smudge floating in the sky
 * with no stem, on the one screen this app exists for.
 */
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

/** Same, for a whole garden and the one it replies to. */
export function drawableGarden(g: GardenData): GardenData {
  const out: GardenData = {
    ...g,
    flowers: Array.isArray(g.flowers) ? g.flowers.map(drawableFlower) : [],
  }
  if (g.previous) out.previous = drawableGarden(g.previous)
  return out
}

// --- Short URLs ---------------------------------------------------------
//
// Gardens live in Workers KV under a 6-character id. `/g/<id>` and `/r/<id>` are two views of one
// record: nothing is URL-encoded, so a link can't be pulled apart or forged into a garden.

/** Origin root. Path routing (/g/, /r/) rules out deploying under a subdirectory. */
function buildAppUrl(): string {
  return window.location.origin
}

/** Curated base62: no 0/O, no 1/l/I. Mirrors the server's generator in gardens.ts — change both. */
const SHORT_ID_PATTERN = /^[A-HJ-NP-Za-km-z2-9]{6}$/

export function isShortId(value: string): boolean {
  return SHORT_ID_PATTERN.test(value)
}

/** Null on any failure. The composer surfaces that: a share link that half-works is worse. */
export async function createShortGarden(
  data: GardenData,
  signal?: AbortSignal,
): Promise<string | null> {
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

/**
 * Fetch a garden by short id.
 *
 * Served `immutable` for a year, so a repeat open never leaves the browser. That cache is also why
 * the normalisation below has to happen here rather than only on the server.
 */
export async function fetchGarden(
  id: string,
  signal?: AbortSignal,
): Promise<GardenData | null> {
  const resp = await fetch(`/api/garden?id=${encodeURIComponent(id)}`, {
    signal: signal ?? null,
  })
  // A real "gone" (bad id, deleted) is a 404 → null, a permanent dead-end. Anything else (offline,
  // 5xx, aborted) throws so the caller can offer a retry instead of falsely claiming the link is
  // expired/mistyped.
  if (resp.status === 404) return null
  if (!resp.ok) throw new Error(`garden fetch failed: ${resp.status}`)
  const json = (await resp.json()) as { garden?: unknown }
  // The single untrusted boundary in the app: everything downstream (the scene, the drift petals,
  // the legend, the share image) reads flower fields straight out of this object and computes
  // geometry from them. Normalizing here rather than at each of those call sites means a field
  // that goes missing can only ever cost a default, not a broken gift.
  if (!json.garden) return null
  return drawableGarden(json.garden as GardenData)
}

export function buildShareUrl(id: string): string {
  return `${buildAppUrl()}/g/${id}`
}

/** "Grow one back". Same id as the share URL — the composer reads it back as a remix seed. */
export function buildRemixUrl(id: string): string {
  return `${buildAppUrl()}/r/${id}`
}
