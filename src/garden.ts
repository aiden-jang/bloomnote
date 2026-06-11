// Garden domain model + URL encoding for AI-designed gardens.
//
// The shape here is shared verbatim between the frontend and the backend
// tool-use schema (see api/design-garden.ts). Keeping a single source of
// truth for the schema means a change to a petal shape or color field
// only has to happen in one place.

export type PetalShape = 'round' | 'elongated' | 'bell' | 'small' | 'star'

export const PETAL_SHAPES: PetalShape[] = ['round', 'elongated', 'bell', 'small', 'star']

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
  to?: string
  /**
   * ISO 8601 timestamp of when the sender hit "Grow their garden." Optional
   * because pre-existing share URLs (from before this field shipped)
   * decode without it; we just don't show the "Grown on …" line in that case.
   */
  createdAt?: string
  /**
   * The previous garden in the thread, if this is a reply. Depth-capped
   * to 1: a `previous` never has its own `previous`, so the URL stays
   * bounded even after many back-and-forths. The user sees current +
   * the one it replied to, no further back.
   */
  previous?: GardenData
}

// --- Short URLs ---------------------------------------------------------
//
// Gardens are stored in Upstash Redis keyed by a 6-character base62 ID.
// The share URL is `/g/<id>` and the reply URL is `/r/<id>` — same
// record, two views. No URL-encoded payloads; all garden data lives
// server-side.

// Always anchor share URLs at the origin root. Assumes the app is
// deployed at a domain root (e.g. blossom.aidenjang.com/) rather than
// in a subdirectory (e.g. example.com/blossom/). Path-based routing
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
      signal,
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
  try {
    const resp = await fetch(`/api/garden?id=${encodeURIComponent(id)}`, {
      signal,
    })
    if (!resp.ok) return null
    const json = (await resp.json()) as { garden?: unknown }
    // Upstash auto-parses JSON on read, so what we get back is already
    // a GardenData-shaped object. No re-validation here — the garden
    // was already validated by the model + post-hoc validator when it
    // was created.
    return (json.garden ?? null) as GardenData | null
  } catch {
    return null
  }
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

// --- Example / fallback garden ------------------------------------------
//
// Used as the initial preview state and when the AI request is unavailable.

export const EXAMPLE_GARDEN: FlowerSpec[] = [
  {
    name: 'Morning Rose',
    meaning: 'For someone who makes ordinary days feel warm.',
    petalColors: ['#FF6B8A', '#FF8FA3', '#FFB3C1'],
    centerColor: '#FFD700',
    stemColor: '#3d6b32',
    petalShape: 'round',
    petalCount: 8,
    stemHeight: 90,
  },
  {
    name: 'Summer Daisy',
    meaning: 'For the friend who is always reliably bright.',
    petalColors: ['#ffffff', '#f0f0f0', '#e8e8e8'],
    centerColor: '#FBBF24',
    stemColor: '#5a8c4e',
    petalShape: 'elongated',
    petalCount: 10,
    stemHeight: 75,
  },
  {
    name: 'Quiet Lavender',
    meaning: 'For the calm one — a small thank-you for steady company.',
    petalColors: ['#A78BFA', '#C4B5FD', '#DDD6FE'],
    centerColor: '#7C3AED',
    stemColor: '#5b7c52',
    petalShape: 'small',
    petalCount: 10,
    stemHeight: 95,
  },
]
