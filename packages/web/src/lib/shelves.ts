import type { FlowerJournalEntry } from './flowerJournal'

/*
 * Two shelves to put a kept flower on, and no more.
 *
 * The journal holds up to eighty flowers in one flat list, which is a pile rather than a shelf. Naming
 * two groupings is the smallest thing that gives it shape, and the names matter more than the mechanism:
 * "things I survived" and "things I want to remember" are the two reasons somebody keeps a flower at all.
 *
 * Deliberately not free-text tags. A taxonomy you maintain is admin, and admin is the opposite of what a
 * keepsake shelf is for. Two fixed names mean the decision is one tap and there is nothing to tidy later.
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

export function shelfLabel(id: ShelfId): string {
  return SHELVES.find(shelf => shelf.id === id)?.label ?? id
}

/**
 * A flower can sit on both shelves at once.
 *
 * The obvious design makes this one field and forces a choice, and the choice is a false one: the thing
 * somebody survived is very often the thing they most want to remember. Making them pick would quietly
 * teach people the shelves are categories rather than feelings.
 */
export function shelvesOf(entry: FlowerJournalEntry): ShelfId[] {
  const raw = entry.shelves
  if (!Array.isArray(raw)) return []
  return SHELVES.map(shelf => shelf.id).filter(id => raw.includes(id))
}

export function isOn(entry: FlowerJournalEntry, id: ShelfId): boolean {
  return shelvesOf(entry).includes(id)
}

/** Add or remove one shelf, leaving the other alone. Canonical order, so stored data never varies. */
export function toggled(entry: FlowerJournalEntry, id: ShelfId): ShelfId[] {
  const current = shelvesOf(entry)
  const next = new Set(current.includes(id) ? current.filter(other => other !== id) : [...current, id])
  return SHELVES.map(shelf => shelf.id).filter(shelfId => next.has(shelfId))
}

export function entriesOn(entries: readonly FlowerJournalEntry[], id: ShelfId): FlowerJournalEntry[] {
  return entries.filter(entry => isOn(entry, id))
}

/**
 * What a flower means to the person who kept it.
 *
 * The sender's meaning came with the garden and stays; this is the keeper's, and it wins where there is
 * one. They are different things worth holding separately: a flower somebody sent to say "congratulations"
 * can be the one you kept because of the week you got it, and overwriting the first to record the second
 * would edit somebody else's message.
 */
export function meaningOf(entry: FlowerJournalEntry): { text: string; mine: boolean } {
  const own = entry.mine?.trim()
  return own ? { text: own, mine: true } : { text: entry.meaning, mine: false }
}

/** Same cap as `memory`, so neither can grow the stored journal without bound. */
export const MAX_MEANING = 240
