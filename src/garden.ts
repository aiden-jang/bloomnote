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

// --- URL encoding --------------------------------------------------------
//
// We pack the garden into a URL query param so the recipient can open the
// link without any server roundtrip. To stay under typical 2KB URL caps
// even with 5 fully-described flowers and a thread, we use short field
// names in the wire format and strip the second level of nesting.

interface WireFlower {
  n: string                // name
  m: string                // meaning
  p: [string, string, string] // petalColors
  c: string                // centerColor
  s: string                // stemColor
  sh: PetalShape           // petalShape
  pc: number               // petalCount
  sht: number              // stemHeight
}

interface WireGarden {
  f: WireFlower[]
  b: string                // bouquetNote
  m: string                // message
  fr: string               // from
  t?: string               // to (recipient name)
  ca?: string              // createdAt (ISO 8601)
  pr?: WireGarden          // previous garden (depth-capped, no pr.pr)
  v: 2                     // schema version
}

function toWireFlower(fl: FlowerSpec): WireFlower {
  return {
    n: fl.name,
    m: fl.meaning,
    p: fl.petalColors,
    c: fl.centerColor,
    s: fl.stemColor,
    sh: fl.petalShape,
    pc: fl.petalCount,
    sht: fl.stemHeight,
  }
}

function fromWireFlower(fl: WireFlower): FlowerSpec {
  return {
    name: fl.n,
    meaning: fl.m,
    petalColors: fl.p,
    centerColor: fl.c,
    stemColor: fl.s,
    petalShape: fl.sh,
    petalCount: fl.pc,
    stemHeight: fl.sht,
  }
}

function toWire(data: GardenData, includePrevious: boolean): WireGarden {
  const wire: WireGarden = {
    v: 2,
    f: data.flowers.map(toWireFlower),
    b: data.bouquetNote,
    m: data.message,
    fr: data.from,
  }
  if (data.to) wire.t = data.to
  if (data.createdAt) wire.ca = data.createdAt
  // Strip second-level nesting: when we encode `previous`, we encode it
  // WITHOUT its own `previous`. That's the depth cap.
  if (includePrevious && data.previous) {
    wire.pr = toWire(data.previous, false)
  }
  return wire
}

function fromWire(wire: WireGarden): GardenData {
  const data: GardenData = {
    flowers: (wire.f ?? []).map(fromWireFlower),
    bouquetNote: wire.b ?? '',
    message: wire.m ?? '',
    from: wire.fr ?? '',
  }
  if (wire.t) data.to = wire.t
  if (wire.ca) data.createdAt = wire.ca
  if (wire.pr) data.previous = fromWire(wire.pr)
  return data
}

function encodeBase64Url(s: string): string {
  return btoa(encodeURIComponent(s))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeBase64Url(s: string): string {
  return decodeURIComponent(atob(s.replace(/-/g, '+').replace(/_/g, '/')))
}

export function encodeGarden(data: GardenData): string {
  return encodeBase64Url(JSON.stringify(toWire(data, true)))
}

export function decodeGarden(encoded: string): GardenData | null {
  try {
    const wire = JSON.parse(decodeBase64Url(encoded)) as WireGarden
    return fromWire(wire)
  } catch {
    return null
  }
}

function buildAppUrl(): string {
  const base = window.location.origin
  const path = window.location.pathname === '/' ? '' : window.location.pathname
  return `${base}${path}`
}

export function buildShareUrl(data: GardenData): string {
  return `${buildAppUrl()}?garden=${encodeGarden(data)}`
}

/**
 * The "grow one back" URL. Encodes the current garden as a remix seed
 * — when the recipient opens it, the composer pre-fills From/To from
 * the inverse of this garden and shows the original note as context.
 *
 * Like the encoded garden itself, the seed is depth-capped to 1 so the
 * URL doesn't accumulate every previous turn of the thread.
 */
export function buildRemixUrl(data: GardenData): string {
  // The seed is just the current garden — we don't bring its `previous`
  // along, because the reply's `previous` will be the current garden,
  // and we don't want to nest deeper.
  const seed: GardenData = { ...data, previous: undefined }
  return `${buildAppUrl()}?remix=${encodeGarden(seed)}`
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
