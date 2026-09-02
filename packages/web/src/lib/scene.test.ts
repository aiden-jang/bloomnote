import { describe, expect, it } from 'vitest'
import { gradientFor, mixHex, placeFlowers, placementKey, SKY_GRADIENTS } from './scene'
import type { FlowerSpec } from '../garden'

const flower = (name: string, color = '#ff0000'): FlowerSpec =>
  ({ name, petalColors: [color, '#ffffff'] }) as unknown as FlowerSpec

describe('mixHex', () => {
  it('returns each end exactly at t=0 and t=1', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff')
  })

  it('meets in the middle', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('always pads to six digits, so the result is a usable colour', () => {
    // Math.round(...).toString(16) drops the leading zero on anything under 16, which would
    // produce '#f0f0f' and render as nothing.
    const out = mixHex('#000000', '#0a0a0a', 0.5)
    expect(out).toMatch(/^#[0-9a-f]{6}$/)
    expect(out).toBe('#050505')
  })

  it('blends each channel independently', () => {
    expect(mixHex('#ff0000', '#0000ff', 0.5)).toBe('#800080')
  })
})

describe('gradientFor', () => {
  it('gives every known occasion its own sky', () => {
    for (const key of Object.keys(SKY_GRADIENTS)) {
      expect(gradientFor(key)).toEqual(SKY_GRADIENTS[key])
    }
  })

  it('falls back to the default rather than leaving a garden with no sky', () => {
    // Gardens are permanent links, so an occasion string from an older release can still arrive.
    for (const unknown of [undefined, '', 'graduation', '__proto__']) {
      expect(gradientFor(unknown), String(unknown)).toEqual(SKY_GRADIENTS['just-because'])
    }
  })
})

describe('placeFlowers', () => {
  it('centres a single flower', () => {
    const [only] = placeFlowers([flower('rose')])
    expect(only!.left).toBe(50)
  })

  it('gives exactly one flower the front depth, whatever the count', () => {
    // The subject of the picture. Two at depth 1 would read as a collision, none as a flat row.
    for (let n = 1; n <= 5; n++) {
      const placed = placeFlowers(Array.from({ length: n }, (_, i) => flower(`f${i}`)))
      expect(
        placed.filter((p) => p.depth === 1),
        `count ${n}`,
      ).toHaveLength(1)
    }
  })

  it('derives z-index from depth, so nearer flowers occlude further ones', () => {
    const placed = placeFlowers([flower('a'), flower('b')])
    const front = placed.find((p) => p.depth === 1)!
    const back = placed.find((p) => p.depth !== 1)!
    expect(front.zIndex).toBeGreaterThan(back.zIndex)
  })

  it('handles an empty garden and one larger than the tuned layouts', () => {
    expect(placeFlowers([])).toEqual([])
    const many = placeFlowers(Array.from({ length: 9 }, (_, i) => flower(`f${i}`)))
    expect(many).toHaveLength(9)
    expect(many.every((p) => Number.isFinite(p.left))).toBe(true)
  })

  it('places the same garden identically every time', () => {
    // No Math.random: a garden is a permanent link and must look the same on every open.
    const garden = [flower('a'), flower('b'), flower('c')]
    expect(placeFlowers(garden)).toEqual(placeFlowers(garden))
  })
})

describe('placementKey', () => {
  it('distinguishes two flowers of the same species by colour', () => {
    expect(placementKey(flower('rose', '#ff0000'), 0)).not.toBe(placementKey(flower('rose', '#00ff00'), 0))
  })

  it('is stable for the same flower in the same slot', () => {
    expect(placementKey(flower('rose'), 2)).toBe(placementKey(flower('rose'), 2))
  })
})
