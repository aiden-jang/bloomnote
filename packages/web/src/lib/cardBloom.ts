import type { FlowerSpec, PetalShape } from '../garden'

const SHAPES: PetalShape[] = ['round', 'elongated', 'bell', 'small', 'star']

/** Small stable hash, so a card draws the same flowers every time it is rendered. */
function hash(value: string): number {
  let h = 0
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** Toward white, for the inner two stops of the petal gradient. */
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

/**
 * A drawable flower for an archive card.
 *
 * The colour is real — it is the flower's own first petal colour, saved with the garden. The
 * silhouette is not, and cannot be: the archive stores one colour per flower and nothing else, and
 * the signed-in list comes from an API that returns the same shape. So the card is a token, not a
 * preview, and the shape comes from the garden's own id: stable every time that card is drawn, and
 * different from the card above it, which is all a row of tokens has to do.
 */
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
