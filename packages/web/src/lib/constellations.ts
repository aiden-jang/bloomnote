import type { FlowerJournalEntry } from './flowerJournal'

/**
 * The shapes your writing keeps making.
 *
 * A constellation is a person, a place or a feeling that turns up in more than one journal entry, and
 * the entries it links. The point is not search. It is being shown a pattern you did not know was
 * there: that Nadia appears in six entries, or that "tired" and "grateful" keep arriving together.
 *
 * Two constraints shaped every decision in here.
 *
 * **Nothing leaves the device.** The journal lives in localStorage precisely because it is the private
 * half of bloomnote, so this is a pure function over local text with no AI call and no network. That
 * rules out the easy version (ask a model to extract entities) and is worth the cost: sending somebody's
 * private journal to a server to find out that it mentions their mother is a bad trade at any accuracy.
 *
 * **Recurrence is the whole idea.** A term seen once is a word; a term seen twice is a thread. So the
 * minimum is two entries, which also does most of the noise filtering for free.
 */

export type ConstellationKind = 'person' | 'place' | 'feeling'

export interface Constellation {
  /** Lowercased key used for grouping. */
  key: string
  /** What to show: the spelling as it appeared, capitalised for people and places. */
  label: string
  kind: ConstellationKind
  /** Journal entry ids this appears in, newest first. Always length >= 2. */
  entryIds: string[]
  /** Distinct entries, which is the number worth showing. Not a streak: it counts subjects, not days. */
  entryCount: number
  /** When it last came up, for ordering by what is live rather than by what is biggest. */
  lastSeenAt: string
}

/**
 * Feelings worth noticing, in their base form.
 *
 * A closed list rather than sentiment scoring, because the job is not "is this entry positive" but "does
 * this exact feeling keep recurring". Deliberately includes the unglamorous ones: a journal that can
 * only notice happiness is no use on the days somebody most needs to look back.
 */
const FEELINGS = [
  'happy', 'sad', 'tired', 'angry', 'calm', 'anxious', 'grateful', 'lonely', 'proud', 'scared',
  'hopeful', 'guilty', 'relieved', 'excited', 'jealous', 'content', 'restless', 'homesick',
  'overwhelmed', 'peaceful', 'embarrassed', 'nervous', 'hurt', 'safe', 'loved', 'missed',
  'exhausted', 'grieving', 'frustrated', 'ashamed', 'joyful', 'bored', 'stressed', 'better',
] as const

/**
 * Inflections folded onto their base feeling.
 *
 * "tiredness", "exhausting" and "exhausted" are one thread, and splitting them means the pattern never
 * reaches the two-entry floor. Kept as an explicit map rather than a stemmer: a general stemmer on a
 * 34-word list is more machinery and more surprises than the list itself.
 */
const FEELING_FORMS: Record<string, string> = {
  happiness: 'happy', sadness: 'sad', tiredness: 'tired', anger: 'angry', calmness: 'calm',
  anxiety: 'anxious', gratitude: 'grateful', loneliness: 'lonely', pride: 'proud', fear: 'scared',
  hope: 'hopeful', guilt: 'guilty', relief: 'relieved', excitement: 'excited', jealousy: 'jealous',
  exhausting: 'exhausted', exhaustion: 'exhausted', grief: 'grieving', frustration: 'frustrated',
  shame: 'ashamed', joy: 'joyful', boredom: 'bored', stress: 'stressed', peace: 'peaceful',
  loving: 'loved', missing: 'missed', hurting: 'hurt', worried: 'anxious', worry: 'anxious',
}

/**
 * Capitalised words that are not names.
 *
 * This list is the main defence now, together with the two-entry floor. Sentence position looked like
 * better evidence and was not: rejecting anything that opens a sentence threw away "Nadia called." and
 * "Theo again.", which is how people actually write in a journal. Recall matters more here than a clean
 * rule, because a missed thread is invisible while a wrong one is merely wrong and filtered by needing
 * to recur.
 */
const NOT_A_NAME = new Set([
  'i', 'the', 'a', 'an', 'and', 'but', 'so', 'then', 'today', 'yesterday', 'tomorrow', 'this',
  'that', 'it', 'we', 'you', 'he', 'she', 'they', 'my', 'his', 'her', 'their', 'our', 'your',
  'there', 'here', 'when', 'what', 'why', 'how', 'if', 'because', 'just', 'still', 'also',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
  'october', 'november', 'december', 'thanks', 'thank', 'happy', 'love', 'ok', 'okay', 'yes', 'no',
  // Sentence openers, which is where a capital is least informative.
  'suddenly', 'honestly', 'finally', 'anyway', 'maybe', 'somehow', 'apparently', 'eventually',
  'everything', 'everyone', 'nothing', 'nobody', 'something', 'someone', 'all', 'both', 'first',
  'last', 'next', 'now', 'once', 'again', 'after', 'before', 'while', 'though', 'although',
  'tonight', 'morning', 'evening', 'afternoon', 'night', 'week', 'weekend', 'god', 'oh', 'well',
  'good', 'bad', 'better', 'worse', 'been', 'had', 'was', 'were', 'did', 'not', 'never', 'always',
])

/** Prepositions that make the capitalised word after them a place rather than a person. */
const PLACE_LEAD = new Set(['at', 'in', 'near', 'around', 'from', 'to', 'outside', 'inside', 'by'])

interface Mention {
  key: string
  label: string
  kind: ConstellationKind
}

function baseFeeling(word: string): string | null {
  const lower = word.toLowerCase()
  if ((FEELINGS as readonly string[]).includes(lower)) return lower
  return FEELING_FORMS[lower] ?? null
}

/** Strip punctuation and possessives so "Nadia's" and "Nadia," are the same thread. */
function cleanToken(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/['’]s$/u, '')
}

function titleCase(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1)
}

/**
 * Everything worth noticing in one entry.
 *
 * Deduplicated per entry on purpose: writing "Nadia" four times in one sitting is one entry about
 * Nadia, and counting mentions instead of entries would let a single long entry invent a pattern.
 */
export function mentionsIn(entry: FlowerJournalEntry): Mention[] {
  const found = new Map<string, Mention>()
  const add = (mention: Mention): void => {
    if (!found.has(`${mention.kind}:${mention.key}`)) found.set(`${mention.kind}:${mention.key}`, mention)
  }

  // The sender is a name we actually know, rather than one guessed from capitalisation.
  const from = entry.from?.trim()
  if (from) add({ key: from.toLowerCase(), label: from, kind: 'person' })

  // Split into sentences anyway: the preposition that marks a place has to be the word before, within
  // the same sentence, or "...at the shop. Nadia called." would read Nadia as a place.
  const sentences = entry.memory.split(/(?<=[.!?])\s+|\n+/)
  for (const sentence of sentences) {
    const tokens = sentence.split(/\s+/).map(cleanToken).filter(Boolean)
    tokens.forEach((token, index) => {
      const lower = token.toLowerCase()

      const feeling = baseFeeling(token)
      if (feeling) {
        add({ key: feeling, label: feeling, kind: 'feeling' })
        return
      }

      const capitalised = /^\p{Lu}/u.test(token)
      if (!capitalised || NOT_A_NAME.has(lower) || token.length < 2) return
      // Shouting is emphasis, never a name. Position is deliberately not consulted: see NOT_A_NAME.
      if (token === token.toUpperCase()) return

      const previous = tokens[index - 1]?.toLowerCase()
      const kind: ConstellationKind = previous && PLACE_LEAD.has(previous) ? 'place' : 'person'
      add({ key: lower, label: titleCase(token), kind })
    })
  }

  return [...found.values()]
}

/** How many entries a thing has to appear in before it counts as a thread rather than a word. */
export const MIN_ENTRIES = 2

/**
 * The constellations across a journal.
 *
 * Sorted by recency first and size second, because the useful question is "what has been on my mind",
 * not "what is my all-time top subject". A name from two years ago outranking this month's would make
 * the whole thing feel like an archive.
 */
export function constellations(entries: FlowerJournalEntry[], minEntries = MIN_ENTRIES): Constellation[] {
  const groups = new Map<string, { label: string; kind: ConstellationKind; ids: Map<string, string> }>()

  for (const entry of entries) {
    for (const mention of mentionsIn(entry)) {
      const id = `${mention.kind}:${mention.key}`
      const group = groups.get(id) ?? { label: mention.label, kind: mention.kind, ids: new Map() }
      // An entry contributes once however many times it says the word.
      group.ids.set(entry.id, entry.savedAt)
      groups.set(id, group)
    }
  }

  return [...groups.values()]
    .filter((group) => group.ids.size >= minEntries)
    .map((group) => {
      const sorted = [...group.ids.entries()].sort((a, b) => b[1].localeCompare(a[1]))
      return {
        key: group.label.toLowerCase(),
        label: group.label,
        kind: group.kind,
        entryIds: sorted.map(([id]) => id),
        entryCount: sorted.length,
        lastSeenAt: sorted[0]![1],
      }
    })
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || b.entryCount - a.entryCount)
}

/**
 * One sentence about a constellation, in bloomnote's lowercase voice.
 *
 * Says what recurs and never how consistently. "four entries" is a fact about subjects; "four weeks in
 * a row" would be a streak, and a journal that can be broken is a chore.
 */
export function constellationLine(c: Constellation): string {
  const times = c.entryCount === 2 ? 'twice' : `${c.entryCount} times`
  if (c.kind === 'feeling') return `you have written about feeling ${c.label} ${times}.`
  if (c.kind === 'place') return `${c.label} has come up ${times}.`
  return `${c.label} is in ${c.entryCount} of your entries.`
}
