export type ShelfId = 'survived' | 'remember'

export interface Shelf {
  id: ShelfId
  label: string
  empty: string
}

export const SHELVES: Shelf[] = [
  { id: 'survived', label: 'things i survived', empty: 'nothing here, which is its own kind of good news.' },
  { id: 'remember', label: 'things i want to remember', empty: 'nothing on this shelf yet.' },
]

/** Both at once. One field forcing a choice would make these categories, and a flower can
    genuinely belong on both. */
export function shelvesOf(entry: { shelves?: string[] }): ShelfId[] {
  const raw = entry.shelves
  if (!Array.isArray(raw)) return []
  return SHELVES.map((shelf) => shelf.id).filter((id) => raw.includes(id))
}

export function isOn(entry: { shelves?: string[] }, id: ShelfId): boolean {
  return shelvesOf(entry).includes(id)
}

/** Canonical order, so stored data never varies by the order somebody tapped. */
export function toggled(entry: { shelves?: string[] }, id: ShelfId): ShelfId[] {
  const current = shelvesOf(entry)
  const next = new Set(current.includes(id) ? current.filter((other) => other !== id) : [...current, id])
  return SHELVES.map((shelf) => shelf.id).filter((shelfId) => next.has(shelfId))
}

export function entriesOn<T extends { shelves?: string[] }>(entries: readonly T[], id: ShelfId): T[] {
  return entries.filter((entry) => isOn(entry, id))
}

/** The keeper's meaning wins and never overwrites the sender's: that would edit somebody
    else's words. */
export function meaningOf(entry: { meaning: string; mine?: string }): { text: string; mine: boolean } {
  const own = entry.mine?.trim()
  return own ? { text: own, mine: true } : { text: entry.meaning, mine: false }
}

/** Same cap as `memory`, so neither can grow the stored journal without bound. */
export const MAX_MEANING = 240
