// Each flower payload is hand-tuned to the mood's palette directives in src/lib/moods.ts. If you
// change those hints, re-curate these or the demo stops matching what the model now produces.

import type { FlowerSpec } from '../garden'

export interface ExampleGarden {
  id: string
  from: string
  to: string
  message: string
  occasion: string
  mood: string
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
      'dr. park you stayed an extra hour after class and gradient descent finally clicked. lowkey changed my whole semester. ty for real.',
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
