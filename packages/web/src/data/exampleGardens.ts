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
      'happy birthday, sarah. hope the tides are interesting and your own jokes continue to entertain you. glad you’re here.',
    occasion: 'birthday',
    mood: 'playful',
    flowers: [
      {
        artVersion: 3,
        name: 'Marigold',
        meaning: 'for laughing at your own jokes. someone has to.',
        petalColors: ['#FFD93D', '#FFC53D', '#FFB845'],
        centerColor: '#D97706',
        stemColor: '#65A30D',
        petalShape: 'star',
        petalCount: 8,
        stemHeight: 92,
      },
      {
        artVersion: 3,
        name: 'Rose',
        meaning: 'for a friend who’s very easy to keep around.',
        petalColors: ['#FF8FA3', '#FFA8C0', '#FFB8C8'],
        centerColor: '#FFD700',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 85,
      },
      {
        artVersion: 3,
        name: 'Sunflower',
        meaning: 'for the tide journal and all the attention it takes.',
        petalColors: ['#FFE66D', '#FFC53D', '#FFB845'],
        centerColor: '#92400E',
        stemColor: '#3D6B32',
        petalShape: 'elongated',
        petalCount: 12,
        stemHeight: 105,
      },
      {
        artVersion: 3,
        name: 'Cosmos',
        meaning: 'for noticing the small things the water keeps doing.',
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
      'saw a kite on the beach today. thought of that windy afternoon in half moon bay. hope LA’s being nice to you.',
    occasion: 'just-because',
    mood: 'wistful',
    flowers: [
      {
        artVersion: 3,
        name: 'Bluebell',
        meaning: 'for that windy afternoon in half moon bay.',
        petalColors: ['#94A3B8', '#A8B5C5', '#B8C5D3'],
        centerColor: '#475569',
        stemColor: '#5B7C52',
        petalShape: 'bell',
        petalCount: 6,
        stemHeight: 95,
      },
      {
        artVersion: 3,
        name: 'Iris',
        meaning: 'for the kite that brought the afternoon back.',
        petalColors: ['#A78BFA', '#B8A4D8', '#C9BDE2'],
        centerColor: '#6D5BA8',
        stemColor: '#5B7C52',
        petalShape: 'elongated',
        petalCount: 10,
        stemHeight: 90,
      },
      {
        artVersion: 3,
        name: 'Hellebore',
        meaning: 'for a memory that still comes to mind.',
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
      'dr. park, you stayed an extra hour after class and gradient descent finally clicked. thank you for making it make sense.',
    occasion: 'thank-you',
    mood: 'steady',
    flowers: [
      {
        artVersion: 3,
        name: 'Rose',
        meaning: 'for the extra hour after class.',
        petalColors: ['#C2825D', '#D4956F', '#E0A883'],
        centerColor: '#92400E',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 92,
      },
      {
        artVersion: 3,
        name: 'Carnation',
        meaning: 'for sticking with the explanation.',
        petalColors: ['#7C9A6E', '#8DAD7D', '#9EBE8C'],
        centerColor: '#4A5E40',
        stemColor: '#3D6B32',
        petalShape: 'round',
        petalCount: 8,
        stemHeight: 96,
      },
      {
        artVersion: 3,
        name: 'Peony',
        meaning: 'for the moment gradient descent finally made sense.',
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
