export interface Mood {
  value: string
  label: string
  /** The line injected into the system prompt when this mood is selected. */
  promptHint: string
}

export const MOODS: readonly Mood[] = [
  {
    value: 'none',
    label: 'no vibe',
    promptHint: '',
  },
  {
    value: 'tender',
    label: 'soft',
    promptHint:
      'Tender tone. Affection, intimacy, quiet warmth. Use soft pastels (pale pinks, ivories, washed lavenders). Petal shapes should lean round and small. The bouquet note should read like a held breath.',
  },
  {
    value: 'playful',
    label: 'unserious',
    promptHint:
      'Playful tone. Joy, mischief, inside jokes. Use brighter palettes (warm yellows, coral pinks, unexpected pops of color). Petal shapes can mix (star, round, elongated). The bouquet note should have the energy of a wink.',
  },
  {
    value: 'wistful',
    label: 'in my feels',
    promptHint:
      'Wistful tone. Missing someone, sentimental, slightly bittersweet. Use muted palettes (dusty blues, faded mauves, soft sages). Petal shapes should lean elongated and bell. The bouquet note should feel like the moment before remembering.',
  },
  {
    value: 'celebratory',
    label: 'hype',
    promptHint:
      'Celebratory tone. Joy, achievement, big energy. Use vivid palettes (golden yellows, deep magentas, hot oranges). Higher petal counts, taller stems. The bouquet note should have lift to it, like raising a glass.',
  },
  {
    value: 'steady',
    label: 'got u',
    promptHint:
      'Steady tone. Solidarity, quiet support, "I am here." Use grounded palettes (forest greens, terracotta, deep cream). Petal shapes should be round and consistent across the bouquet. The bouquet note should read like a hand on the shoulder.',
  },
] as const

export const DEFAULT_MOOD: Mood['value'] = 'none'
