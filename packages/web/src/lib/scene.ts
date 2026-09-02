import type { FlowerSpec } from '../garden'

/* Occasion owns the hue. The hour only blends toward a base, so the emotional signal survives. */
// prettier-ignore
export const SKY_GRADIENTS: Record<string, { top: string; bottom: string }> = {
  'just-because': { top: '#d4eeff', bottom: '#e8f5d0' },
  birthday:       { top: '#fde6cf', bottom: '#fff1d8' },
  'thank-you':    { top: '#e2efd9', bottom: '#f0f5e3' },
  anniversary:    { top: '#f6e0e8', bottom: '#f9efe0' },
  congrats:       { top: '#fde2c0', bottom: '#ffeac8' },
  'get-well':     { top: '#d4ecdd', bottom: '#e8f4d8' },
  sympathy:       { top: '#d8dde6', bottom: '#e5e9ef' },
}

/** Object.hasOwn, not `in`: `in` matches '__proto__' and turns a stored string into a lookup on
    Object.prototype. An unknown occasion gets the default sky rather than no sky. */
export function gradientFor(occasion?: string): { top: string; bottom: string } {
  if (occasion && Object.hasOwn(SKY_GRADIENTS, occasion)) return SKY_GRADIENTS[occasion]!
  return SKY_GRADIENTS['just-because']!
}

export function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, '0')
  return `#${ch(ar!, br!)}${ch(ag!, bg!)}${ch(ab!, bb!)}`
}

export interface Placement {
  spec: FlowerSpec
  left: number
  zIndex: number
  depth: number
}

/* Hand-written, not computed: neighbours must alternate near and far or the row reads as a ramp. */
const DEPTHS: Record<number, number[]> = {
  1: [1],
  2: [1, 0.74],
  3: [0.74, 1, 0.82],
  4: [0.7, 1, 0.76, 0.9],
  5: [0.68, 0.9, 1, 0.74, 0.84],
}

/** Nudges so the row is not a perfect arithmetic progression. Deterministic, like the petal drift. */
const LEFT_JITTER = [0, 2.4, -1.8, 1.2, -2.6]

export function placeFlowers(flowers: FlowerSpec[]): Placement[] {
  const count = flowers.length
  if (count === 0) return []

  const spread = 70
  const center = 50
  const step = count > 1 ? spread / (count - 1) : 0
  const start = center - spread / 2
  const depths = DEPTHS[count] ?? flowers.map(() => 1)

  return flowers.map((spec, i) => {
    const depth = depths[i] ?? 1
    return {
      spec,
      left: count === 1 ? center : start + i * step + (LEFT_JITTER[i] ?? 0),
      // Nearer flowers occlude further ones. Focus still lifts a flower above all of them.
      zIndex: Math.round(depth * 10),
      depth,
    }
  })
}

/** Stable identity for a placed flower, so React keeps the DOM node when the array reference
    changes but the flowers have not. */
export function placementKey(spec: FlowerSpec, index: number): string {
  return `${index}-${spec.name}-${spec.petalColors[0]}`
}
