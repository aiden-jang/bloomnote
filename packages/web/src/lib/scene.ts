import type { FlowerSpec } from '../garden'

/*
 * The scene's geometry and colour maths.
 *
 * Everything here is pure and was previously only reachable by rendering the garden, which is
 * why none of it had a test. The SVG parts of the scene stay in the component: they are shapes,
 * not decisions.
 */

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

/**
 * An unknown or missing occasion gets the default sky rather than no sky.
 *
 * Object.hasOwn, not `in`: `in` walks the prototype chain, so `'__proto__' in SKY_GRADIENTS` is
 * true and the lookup hands back Object.prototype — a garden whose sky is `undefined`. An
 * occasion is stored verbatim and a garden link is permanent, so any string can arrive here.
 */
export function gradientFor(occasion?: string): { top: string; bottom: string } {
  if (occasion && Object.hasOwn(SKY_GRADIENTS, occasion)) return SKY_GRADIENTS[occasion]!
  return SKY_GRADIENTS['just-because']!
}

/** Blend two `#rrggbb` colours. `t` is 0 for all of `a`, 1 for all of `b`. */
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
  /** 1 is nearest the viewer, lower is further back. Drives scale, ground position and haze. */
  depth: number
}

/*
 * Depth per flower count. Hand-written, not computed: neighbours must alternate near/far or an
 * overlap reads as two flowers colliding. Every row gives exactly one flower depth 1, the subject.
 */
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

  // Tight enough that the sprites genuinely overlap, which is the point.
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

/**
 * Stable identity for a placed flower, so React keeps the DOM node when the array reference
 * changes but the flowers are the same. A positional key would restart the bloom animation.
 */
export function placementKey(spec: FlowerSpec, index: number): string {
  return `${index}-${spec.name}-${spec.petalColors[0]}`
}
