import { constellations, type Constellation } from './constellations'
import type { FlowerJournalEntry } from './flowerJournal'

/* Describes subjects, never cadence: no day counts, no comparison to last week, nothing to fall
   behind on. */

export const RECENT_WINDOW_DAYS = 14

export interface GardenRecap {
  entryCount: number
  threads: Constellation[]
  line: string | null
}

function within(entry: FlowerJournalEntry, since: number): boolean {
  const at = new Date(entry.savedAt).getTime()
  return Number.isFinite(at) && at >= since
}

/** Oxford-free "and", because three items is the most this ever lists. */
function listOf(items: string[]): string {
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

export function gardenRecap(
  entries: FlowerJournalEntry[],
  now = new Date(),
  windowDays = RECENT_WINDOW_DAYS,
): GardenRecap {
  const since = now.getTime() - windowDays * 86_400_000
  const recent = entries.filter((entry) => within(entry, since))
  const threads = constellations(recent)

  if (recent.length === 0) return { entryCount: 0, threads: [], line: null }

  /* A window with entries but no recurring thread gets nothing, rather than a consolation sentence
     that says less than silence. */
  if (threads.length === 0) return { entryCount: recent.length, threads, line: null }

  const people = threads.filter((t) => t.kind === 'person').map((t) => t.label)
  const feelings = threads.filter((t) => t.kind === 'feeling').map((t) => t.label)
  const places = threads.filter((t) => t.kind === 'place').map((t) => t.label)

  const clauses: string[] = []
  if (people.length > 0) clauses.push(`${listOf(people.slice(0, 3))} kept coming up`)
  if (places.length > 0) clauses.push(`so did ${listOf(places.slice(0, 2))}`)
  if (feelings.length > 0) clauses.push(`you wrote about feeling ${listOf(feelings.slice(0, 2))}`)

  return { entryCount: recent.length, threads, line: `lately, ${listOf(clauses)}.` }
}
