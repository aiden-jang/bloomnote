// Garden domain model + URL encoding for AI-designed gardens.
//
// The shape here is shared verbatim between the frontend and the backend
// tool-use schema (see api/design-garden.ts). Keeping a single source of
// truth for the schema means a change to a petal shape or color field
// only has to happen in one place.

export type PetalShape = 'round' | 'elongated' | 'bell' | 'small' | 'star'

/** A single AI-designed flower. Renders without any preset table. */
export interface FlowerSpec {
  /** Poetic, invented name. */
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

export interface GardenData {
  flowers: FlowerSpec[]
  /** Optional one or two-sentence note about the whole garden, AI-written. */
  bouquetNote: string
  /** User-provided personal message. */
  message: string
  /** Sender name. */
  from: string
  /** Recipient name. */
  to?: string | undefined
  /**
   * ISO 8601 timestamp of when the sender hit "Grow their garden." Optional
   * because pre-existing share URLs (from before this field shipped)
   * decode without it; we just don't show the "Grown on …" line in that case.
   */
  createdAt?: string | undefined
  /**
   * ISO 8601 timestamp before which the garden stays sealed (time-capsule
   * mode). The recipient sees a countdown until this moment, then the
   * garden becomes openable. Omit for immediate delivery.
   *
   * Clock skew note: comparison is recipient-clock vs server-stored UTC.
   * A determined recipient can spoof their device clock and unlock early,
   * which is acceptable for a "moment of joy" product — this is not a
   * security boundary, it's a UX choreography.
   */
  unlockAt?: string | undefined
  /**
   * The occasion (mirror of OCCASIONS values in src/lib/occasions.ts) the
   * sender chose. Stored so the recipient view can reflect the same
   * atmosphere — e.g. the sky gradient shifts to muted cool tones for
   * sympathy gardens, warm peach for birthdays. Optional because
   * pre-existing gardens (from before this field shipped) decode without
   * it; we just fall back to the default gradient.
   */
  occasion?: string | undefined
  /**
   * The mood (mirror of MOODS values in src/lib/moods.ts) the sender
   * chose. Currently informational only — preserved so we can light up
   * mood-driven UI variations in the future without re-encoding old
   * gardens. Same backwards-compat reasoning as `occasion`.
   */
  mood?: string | undefined
  /**
   * The previous garden in the thread, if this is a reply. Depth-capped
   * to 1: a `previous` never has its own `previous`, so the URL stays
   * bounded even after many back-and-forths. The user sees current +
   * the one it replied to, no further back.
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
// Gardens are stored in Upstash Redis keyed by a 6-character base62 ID.
// The share URL is `/g/<id>` and the reply URL is `/r/<id>` — same
// record, two views. No URL-encoded payloads; all garden data lives
// server-side.

// Always anchor share URLs at the origin root. Assumes the app is
// deployed at a domain root (e.g. bloomnote.aidenjang.com/) rather than
// in a subdirectory (e.g. example.com/bloomnote/). Path-based routing
// (/g/<...>, /r/<...>) doesn't compose with subdirectory deployments
// — if that ever becomes a requirement, this function and the route
// matchers in App.tsx and Composer.tsx all need to learn about the
// base path together.
function buildAppUrl(): string {
  return window.location.origin
}

/**
 * Short IDs are 6 characters from a curated base62 alphabet (no 0/O,
 * no 1/l/I). The pattern is shared with the server's generator in
 * api/garden.ts; if you change one, change both.
 */
const SHORT_ID_PATTERN = /^[A-HJ-NP-Za-km-z2-9]{6}$/

export function isShortId(value: string): boolean {
  return SHORT_ID_PATTERN.test(value)
}

/**
 * Create a short-URL record for this garden by POSTing it to
 * /api/garden. Returns the short ID on success; returns null on any
 * failure. The composer surfaces the failure to the user — there's no
 * silent fallback to a self-contained URL anymore.
 */
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
 * Fetch a garden by short ID. Returns null on 404 or any other
 * failure — the caller decides how to render the missing state.
 *
 * The response is aggressively cacheable (the server sets
 * `Cache-Control: immutable`) so repeat opens of the same link from
 * the same browser don't hit Redis or the CDN twice.
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

/**
 * The "grow one back" URL. Points at the same short ID as the share
 * URL — one storage record serves both views. The composer fetches
 * the same garden by ID, then uses it as a remix seed.
 */
export function buildRemixUrl(id: string): string {
  return `${buildAppUrl()}/r/${id}`
}

