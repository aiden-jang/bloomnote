// Curated example gardens shown on the homepage to onboard first-time
// visitors. Three examples covering meaningfully different moods +
// occasions so the visitor sees the range of what bloomnote can produce
// before being asked to write anything themselves.
//
// Why hardcoded instead of pulled from the public wall: we control the
// quality bar exactly. Visitors land and immediately see *good*
// gardens — no profanity, no mid-tier outputs, no empty bouquets.
// First-impression risk dominates discovery risk for an unfamiliar
// product.
//
// To rotate these: replace the entries below. Each flower payload was
// hand-tuned to match the mood's palette directives in src/lib/moods.ts;
// if you tweak the mood prompt hints, consider re-curating these
// examples so the demo stays consistent with what the AI now produces.

import type { FlowerSpec } from '../garden'

export interface ExampleGarden {
  /** Stable identifier used for analytics + React keys. */
  id: string
  from: string
  to: string
  /** The user-visible note. Kept under ~180 chars so the snippet
   *  reads cleanly in the card without truncation. */
  message: string
  /** Mirror of OCCASIONS values in src/lib/occasions.ts. */
  occasion: string
  /** Mirror of MOODS values in src/lib/moods.ts. */
  mood: string
  /** Pre-rendered flowers. These would normally come from Gemini;
   *  hand-curated here for deterministic display + zero cold-start
   *  latency on the homepage. */
  flowers: FlowerSpec[]
}

export const EXAMPLE_GARDENS: ExampleGarden[] = [
  {
    id: 'birthday-sarah',
    from: 'Maya',
    to: 'Sarah',
    message:
      "happy bday sarah!! you're the only person alive who keeps a tide journal AND laughs too hard at her own jokes. no notes, so glad you exist.",
    occasion: 'birthday',
    mood: 'playful',
    flowers: [
      {
        name: 'Marigold',
        meaning: 'for the friend who keeps laughing at her own jokes.',
        petalColors: ['#FFD93D', '#FFC53D', '#FFB845'],
        centerColor: '#D97706',
        stemColor: '#65A30D',
        petalShape: 'star',
        petalCount: 8,
        stemHeight: 92,
      },
      {
        name: 'Coral Rose',
        meaning: 'soft warmth, the way old friendship feels at the kitchen table.',
        petalColors: ['#FF8FA3', '#FFA8C0', '#FFB8C8'],
        centerColor: '#FFD700',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 85,
      },
      {
        name: 'Sunflower',
        meaning: 'someone who turns toward you, like these turn toward light.',
        petalColors: ['#FFE66D', '#FFC53D', '#FFB845'],
        centerColor: '#92400E',
        stemColor: '#3D6B32',
        petalShape: 'elongated',
        petalCount: 12,
        stemHeight: 105,
      },
      {
        name: 'Cosmos',
        meaning: 'for the tide journal. for noticing small things that repeat.',
        petalColors: ['#F472B6', '#FB7185', '#F9A8D4'],
        centerColor: '#FBBF24',
        stemColor: '#5A8C4E',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 98,
      },
    ],
  },
  {
    id: 'wistful-jamie',
    from: 'Casey',
    to: 'Jamie',
    message:
      "saw a kite on the beach today and immediately thought of that windy afternoon in half moon bay. anyway. hope LA's being nice to you.",
    occasion: 'just-because',
    mood: 'wistful',
    flowers: [
      {
        name: 'Bluebell',
        meaning: 'the color of the sky that windy afternoon.',
        petalColors: ['#94A3B8', '#A8B5C5', '#B8C5D3'],
        centerColor: '#475569',
        stemColor: '#5B7C52',
        petalShape: 'bell',
        petalCount: 6,
        stemHeight: 95,
      },
      {
        name: 'Dusty Mauve',
        meaning: 'for the memory you keep returning to without meaning to.',
        petalColors: ['#A78BFA', '#B8A4D8', '#C9BDE2'],
        centerColor: '#6D5BA8',
        stemColor: '#5B7C52',
        petalShape: 'elongated',
        petalCount: 10,
        stemHeight: 90,
      },
      {
        name: 'Sage Bloom',
        meaning: 'for the long distance between people who used to be close.',
        petalColors: ['#9CA38C', '#B0B7A2', '#C2C9B7'],
        centerColor: '#5B6F4F',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 88,
      },
    ],
  },
  {
    id: 'thanks-park',
    from: 'Theo',
    to: 'Dr. Park',
    message:
      "dr. park you stayed an extra hour after class and gradient descent finally clicked. lowkey changed my whole semester. ty for real.",
    occasion: 'thank-you',
    mood: 'steady',
    flowers: [
      {
        name: 'Terracotta Rose',
        meaning: 'for teaching that makes a hard thing solid.',
        petalColors: ['#C2825D', '#D4956F', '#E0A883'],
        centerColor: '#92400E',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 92,
      },
      {
        name: 'Forest Bloom',
        meaning: 'steady the way a good mentor is steady.',
        petalColors: ['#7C9A6E', '#8DAD7D', '#9EBE8C'],
        centerColor: '#4A5E40',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 96,
      },
      {
        name: 'Cream Peony',
        meaning: 'for the click. when something hard finally fits.',
        petalColors: ['#F0E4D0', '#F5EAD8', '#FAF1E3'],
        centerColor: '#92400E',
        stemColor: '#5A8C4E',
        petalShape: 'round',
        petalCount: 10,
        stemHeight: 86,
      },
    ],
  },
]
