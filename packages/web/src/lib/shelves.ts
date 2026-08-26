import type { FlowerJournalEntry } from './flowerJournal'

/*
 * Eighty flowers in one flat list is a pile. Two fixed names rather than free-text tags: a taxonomy you
 * maintain is admin, and admin is the opposite of a keepsake shelf.
 */

export type ShelfId = 'survived' | 'remember'

export interface Shelf {
  id: ShelfId
  label: string
  /** Shown when the shelf is empty. Never nudges: an empty shelf is a fine thing to have. */
  empty: string
}

export const SHELVES: Shelf[] = [
  { id: 'survived', label: 'things i survived', empty: 'nothing here, which is its own kind of good news.' },
  { id: 'remember', label: 'things i want to remember', empty: 'nothing on this shelf yet.' },
]

/** Both at once. One field forcing a choice makes these categories, and the thing somebody survived is
 *  very often the thing they most want to remember. */
export function shelvesOf(entry: FlowerJournalEntry): ShelfId[] {
  const raw = entry.shelves
  if (!Array.isArray(raw)) return []
  return SHELVES.map((shelf) => shelf.id).filter((id) => raw.includes(id))
}

export function isOn(entry: FlowerJournalEntry, id: ShelfId): boolean {
  return shelvesOf(entry).includes(id)
}

/** Add or remove one shelf, leaving the other alone. Canonical order, so stored data never varies. */
export function toggled(entry: FlowerJournalEntry, id: ShelfId): ShelfId[] {
  const current = shelvesOf(entry)
  const next = new Set(current.includes(id) ? current.filter((other) => other !== id) : [...current, id])
  return SHELVES.map((shelf) => shelf.id).filter((shelfId) => next.has(shelfId))
}

export function entriesOn(entries: readonly FlowerJournalEntry[], id: ShelfId): FlowerJournalEntry[] {
  return entries.filter((entry) => isOn(entry, id))
}

/** The keeper's meaning wins, and never overwrites the sender's: that would edit somebody else's
 *  message, and a flower sent to say congratulations can be kept for the week you got it. */
export function meaningOf(entry: FlowerJournalEntry): { text: string; mine: boolean } {
  const own = entry.mine?.trim()
  return own ? { text: own, mine: true } : { text: entry.meaning, mine: false }
}

/** Same cap as `memory`, so neither can grow the stored journal without bound. */
export const MAX_MEANING = 240
