import { constellations, type Constellation } from './constellations'
import type { FlowerJournalEntry } from './flowerJournal'

/*
 * A recap of what you have been writing about.
 *
 * Built on constellations rather than on counting, and that is the whole design. The obvious version of
 * "weekly recap" is a scoreboard: entries this week, longest streak, percentage change. That version
 * makes a journal into something you can be behind on, and bloomnote's entire premise is the opposite.
 *
 * So this describes *subjects*, never cadence. It will happily say "Nadia and the rain kept coming up"
 * and it will never say how many days you wrote, whether that is more or less than last week, or that
 * you missed any. There is nothing in here to fall behind on, which is also why quiet mode does not need
 * to switch it off: see `quietMode.ts` for the same rule stated from the other side.
 *
 * Windowed rather than genuinely weekly. "The last while" is the honest description of a journal somebody
 * writes in irregularly, and a strict Monday-to-Sunday boundary would produce empty recaps that read as
 * failure reports.
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
