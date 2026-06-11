// The mood picker. Separate axis from occasion: occasion says *when*
// ("birthday", "sympathy"), mood says *how* ("tender", "playful",
// "wistful"). The two compose — a birthday garden can be playful OR
// wistful, and they'd look meaningfully different.
//
// Why a second picker instead of expanding occasions: a single
// flattened list ("birthday-playful", "birthday-wistful", ...) would
// explode combinatorially and force the user to pick from 35+ options.
// Two orthogonal axes keep each picker focused.
//
// Default is 'none' — first-time users shouldn't be asked to introspect
// about emotional tone before they've written anything. The backend
// silently falls back to "no mood guidance" when mood is 'none'.

export interface Mood {
  /** Wire-format key. Stable across UI label refreshes. */
  value: string
  /** What the user sees in the dropdown. */
  label: string
  /**
   * The line we inject into the system prompt when this mood is
   * selected. Phrased as a directive to the model, not a description
   * to the user. Keeps the per-mood styling logic in one place rather
   * than scattered across api/prompt.ts and the UI.
   */
  promptHint: string
}

// Five starter moods grounded in real emotional vocabulary, not
// greeting-card cliché. Ordered loosely from intimate to expressive.
//
// The 'none' entry is the absence-of-signal default. It's included
// here (not just as a sentinel) so the picker has a clear "skip this"
// option rendered like any other choice.
export const MOODS: readonly Mood[] = [
  {
    value: 'none',
    label: 'no mood',
    promptHint: '',
  },
  {
    value: 'tender',
    label: 'tender',
    promptHint:
      'Tone is tender — affection, intimacy, quiet warmth. Soft pastels: pale pinks, ivories, washed lavenders. Petal shapes lean round and small. Bouquet note reads like a held breath.',
  },
  {
    value: 'playful',
    label: 'playful',
    promptHint:
      'Tone is playful — joy, mischief, inside jokes. Brighter palettes: warm yellows, coral pinks, unexpected pops of color. Petal shapes can mix (star + round + elongated). Bouquet note has the energy of a wink.',
  },
  {
    value: 'wistful',
    label: 'wistful',
    promptHint:
      'Tone is wistful — missing someone, sentimental, slightly bittersweet. Muted palettes: dusty blues, faded mauves, soft sages. Petal shapes lean elongated and bell. Bouquet note feels like the moment before remembering.',
  },
  {
    value: 'celebratory',
    label: 'celebratory',
    promptHint:
      'Tone is celebratory — joy, achievement, big energy. Vivid palettes: golden yellows, deep magentas, hot oranges. Higher petal counts, taller stems. Bouquet note has lift to it, like raising a glass.',
  },
  {
    value: 'steady',
    label: 'steady',
    promptHint:
      'Tone is steady — solidarity, quiet support, "I am here." Grounded palettes: forest greens, terracotta, deep cream. Petal shapes are round and consistent across the bouquet. Bouquet note reads like a hand on the shoulder.',
  },
] as const

export const DEFAULT_MOOD: Mood['value'] = 'none'

export const MOOD_VALUES = new Set<string>(MOODS.map(m => m.value))

/**
 * Server-side helper: given a mood value, return the prompt hint to
 * splice into the system prompt. Returns null for 'none' or any
 * unknown value, signaling "skip the mood block entirely."
 *
 * The backend imports this from `src/lib/moods.ts` directly — same
 * module serves both sides of the wire because the mood list is
 * shared truth and re-exporting it through a separate constant on
 * the API side would create two sources of drift.
 */
export function promptHintFor(value: string): string | null {
  const mood = MOODS.find(m => m.value === value)
  if (!mood || mood.value === 'none') return null
  return mood.promptHint
}
