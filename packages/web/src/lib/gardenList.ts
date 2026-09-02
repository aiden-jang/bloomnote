/*
 * Ordering, filtering and pinning for the "your gardens" archive.
 *
 * All pure except the two storage calls, which are the same best-effort shape as everywhere
 * else in this app: pinning is an on-device convenience and must never stop the archive
 * rendering.
 */

/** The subset of a garden the archive list needs. */
export interface CardData {
  id: string
  from?: string | undefined
  to: string
  occasion?: string | undefined
  createdAt: string
  unlockAt?: string | undefined
  receivedAt?: string | undefined
  swatches: string[]
}

export type GardenSort = 'newest' | 'oldest' | 'watered'

const PINNED_STORAGE_KEY = 'bloomnote:pinned-gardens'

export function readPinnedGardens(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PINNED_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function writePinnedGardens(ids: string[]): void {
  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // See readPinnedGardens.
  }
}

/**
 * Pinned first, then the chosen sort.
 *
 * Pinning always outranks the sort: someone who pinned a garden wants it at the top, and having
 * it slide away when they change the sort would read as the pin not working. Sorting by watered
 * still falls back to date, so gardens nobody has watered keep a stable order instead of
 * shuffling on every render.
 */
export function orderGardens<T extends CardData>(
  gardens: T[],
  pinned: string[],
  sort: GardenSort,
  waters: Record<string, number>,
): T[] {
  const ids = new Set(pinned)
  return [...gardens].sort((a, b) => {
    const pinOrder = Number(ids.has(b.id)) - Number(ids.has(a.id))
    if (pinOrder) return pinOrder
    if (sort === 'watered') {
      const waterOrder = (waters[b.id] ?? 0) - (waters[a.id] ?? 0)
      if (waterOrder) return waterOrder
    }
    const aDate = new Date(a.receivedAt ?? a.createdAt).getTime()
    const bDate = new Date(b.receivedAt ?? b.createdAt).getTime()
    return sort === 'oldest' ? aDate - bDate : bDate - aDate
  })
}

/** Match on the names and the occasion. Never the note: the archive never holds one. */
export function filterGardens<T extends CardData>(gardens: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return gardens
  return gardens.filter((garden) =>
    [garden.from, garden.to, garden.occasion]
      .filter((part): part is string => typeof part === 'string')
      .some((part) => part.toLocaleLowerCase().includes(needle)),
  )
}
