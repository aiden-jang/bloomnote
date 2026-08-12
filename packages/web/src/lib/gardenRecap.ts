import { constellations, type Constellation } from './constellations'
import type { FlowerJournalEntry } from './flowerJournal'

/*
 * Describes subjects, never cadence: no day counts, no comparison to last week, nothing to fall behind
 * on. Windowed rather than weekly, or an irregular writer gets empty recaps that read as failure reports.
 */

export const RECENT_WINDOW_DAYS = 14

export interface GardenRecap {
  /** Entries inside the window, newest first. */
  entryCount: number
  /** The threads inside the window, most recent first. Empty when nothing recurred. */
  threads: Constellation[]
  /** One sentence, or null when there is genuinely nothing to say yet. */
  line: string | null
}

function within(entry: FlowerJournalEntry, since: number): boolean {
  const at = new Date(entry.savedAt).getTime()
  return Number.isFinite(at) && at >= since
}

/** Join with an Oxford-free "and", because three items is the most this ever lists. */
function listOf(items: string[]): string {
  if (items.length === 1) return items[0]!
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/**
 * What has been on somebody's mind lately.
 *
 * @param now injected so the window is testable rather than dependent on when the suite runs.
 */
export function gardenRecap(
  entries: FlowerJournalEntry[],
  now = new Date(),
  windowDays = RECENT_WINDOW_DAYS,
): GardenRecap {
  const since = now.getTime() - windowDays * 86_400_000
  const recent = entries.filter((entry) => within(entry, since))
  const threads = constellations(recent)

  if (recent.length === 0) return { entryCount: 0, threads: [], line: null }

  /*
   * A window with entries but no recurring thread gets nothing rather than a consolation sentence.
   *
   * "You wrote 3 times but nothing repeated" is a report card with the numbers filed off. Saying nothing
   * is the correct output: there is no pattern yet, and inventing one to fill the space is how this turns
   * into the scoreboard it is meant not to be.
   */
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
