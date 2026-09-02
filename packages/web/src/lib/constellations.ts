import type { FlowerJournalEntry } from './flowerJournal'

export type ConstellationKind = 'person' | 'place' | 'feeling'

export interface Constellation {
  key: string
  label: string
  kind: ConstellationKind
  entryIds: string[]
  /** Distinct entries. Not a streak: it counts subjects, not days. */
  entryCount: number
  lastSeenAt: string
}

/** A closed list, not sentiment scoring: the job is "does this feeling recur". */
const FEELINGS = [
  'happy',
  'sad',
  'tired',
  'angry',
  'calm',
  'anxious',
  'grateful',
  'lonely',
  'proud',
  'scared',
  'hopeful',
  'guilty',
  'relieved',
  'excited',
  'jealous',
  'content',
  'restless',
  'homesick',
  'overwhelmed',
  'peaceful',
  'embarrassed',
  'nervous',
  'hurt',
  'safe',
  'loved',
  'missed',
  'exhausted',
  'grieving',
  'frustrated',
  'ashamed',
  'joyful',
  'bored',
  'stressed',
  'better',
] as const

/** "tiredness" and "exhausted" are one thread; split, they never reach the two-entry floor. */
const FEELING_FORMS: Record<string, string> = {
  happiness: 'happy',
  sadness: 'sad',
  tiredness: 'tired',
  anger: 'angry',
  calmness: 'calm',
  anxiety: 'anxious',
  gratitude: 'grateful',
  loneliness: 'lonely',
  pride: 'proud',
  fear: 'scared',
  hope: 'hopeful',
  guilt: 'guilty',
  relief: 'relieved',
  excitement: 'excited',
  jealousy: 'jealous',
  exhausting: 'exhausted',
  exhaustion: 'exhausted',
  grief: 'grieving',
  frustration: 'frustrated',
  shame: 'ashamed',
  joy: 'joyful',
  boredom: 'bored',
  stress: 'stressed',
  peace: 'peaceful',
  loving: 'loved',
  missing: 'missed',
  hurting: 'hurt',
  worried: 'anxious',
  worry: 'anxious',
}

/** Don't use sentence position instead. Rejecting sentence-openers threw away "Nadia called.",
    which is exactly the mention worth catching. */
const NOT_A_NAME = new Set([
  'i',
  'the',
  'a',
  'an',
  'and',
  'but',
  'so',
  'then',
  'today',
  'yesterday',
  'tomorrow',
  'this',
  'that',
  'it',
  'we',
  'you',
  'he',
  'she',
  'they',
  'my',
  'his',
  'her',
  'their',
  'our',
  'your',
  'there',
  'here',
  'when',
  'what',
  'why',
  'how',
  'if',
  'because',
  'just',
  'still',
  'also',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'thanks',
  'thank',
  'happy',
  'love',
  'ok',
  'okay',
  'yes',
  'no',
  'suddenly',
  'honestly',
  'finally',
  'anyway',
  'maybe',
  'somehow',
  'apparently',
  'eventually',
  'everything',
  'everyone',
  'nothing',
  'nobody',
  'something',
  'someone',
  'all',
  'both',
  'first',
  'last',
  'next',
  'now',
  'once',
  'again',
  'after',
  'before',
  'while',
  'though',
  'although',
  'tonight',
  'morning',
  'evening',
  'afternoon',
  'night',
  'week',
  'weekend',
  'god',
  'oh',
  'well',
  'good',
  'bad',
  'better',
  'worse',
  'been',
  'had',
  'was',
  'were',
  'did',
  'not',
  'never',
  'always',
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

/** Deduplicated per entry: counting mentions would let one long entry invent a pattern. */
export function mentionsIn(entry: FlowerJournalEntry): Mention[] {
  const found = new Map<string, Mention>()
  const add = (mention: Mention): void => {
    if (!found.has(`${mention.kind}:${mention.key}`)) found.set(`${mention.kind}:${mention.key}`, mention)
  }

  const from = entry.from?.trim()
  if (from) add({ key: from.toLowerCase(), label: from, kind: 'person' })

  // Split into sentences anyway: the preposition marking a place has to be the word before within
  // the same sentence, or "...at the shop. Nadia called." reads Nadia as a place.
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

/** Recency before size: "what has been on my mind", not an all-time chart. */
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

/** What recurs, never how consistently: "four entries" is a subject, "four weeks running" is a streak. */
export function constellationLine(c: Constellation): string {
  const times = c.entryCount === 2 ? 'twice' : `${c.entryCount} times`
  if (c.kind === 'feeling') return `you have written about feeling ${c.label} ${times}.`
  if (c.kind === 'place') return `${c.label} has come up ${times}.`
  return `${c.label} is in ${c.entryCount} of your entries.`
}
