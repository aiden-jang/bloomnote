import type { FlowerSpec, PetalShape } from '../garden'

const SHAPES: PetalShape[] = ['round', 'elongated', 'bell', 'small', 'star']

/** Small stable hash, so a card draws the same flowers every time it is rendered. */
function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

function lighten(hex: string, amount: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  const mix = (c: number): number => Math.round(c + (255 - c) * amount)
  const r = mix((n >> 16) & 0xff)
  const g = mix((n >> 8) & 0xff)
  const b = mix(n & 0xff)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** A drawable flower for an archive card. The colour is real; the silhouette is not, because
    the list summary stores swatches rather than full specs. */
export function cardBloom(color: string, gardenId: string, index: number): FlowerSpec {
  const h = hash(`${gardenId}:${index}`)
  return {
    name: '',
    meaning: '',
    petalColors: [color, lighten(color, 0.18), lighten(color, 0.36)],
    centerColor: '#f4e3ad',
    stemColor: '#4a7a4e',
    petalShape: SHAPES[h % SHAPES.length]!,
    petalCount: 7 + (h % 6),
    stemHeight: 90,
  }
}
