import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildRemixUrl, buildShareUrl, drawableFlower, drawableGarden, isShortId } from './garden'

const GOOD = {
  name: 'Hydrangea',
  meaning: 'For four hours in the rain.',
  petalColors: ['#6f8fd0', '#8fa8dd', '#b3c4ea'] as [string, string, string],
  centerColor: '#f0c674',
  stemColor: '#5f8a52',
  petalShape: 'round' as const,
  petalCount: 9,
  stemHeight: 96,
}

afterEach(() => vi.unstubAllGlobals())

describe('isShortId', () => {
  it('accepts six characters from the curated alphabet', () => {
    expect(isShortId('kWzDsL')).toBe(true)
    expect(isShortId('abcdef')).toBe(true)
  })

  /*
   * The alphabet drops 0/O and 1/l/I on purpose, because those are the pairs people mistype when
   * reading a link off a screen. An id containing one was never issued.
   */
  it('rejects the characters the generator never issues', () => {
    for (const id of ['abc0de', 'abcOde', 'abc1de', 'abclde', 'abcIde']) {
      expect(isShortId(id)).toBe(false)
    }
  })

  it('rejects anything that is not exactly six characters', () => {
    expect(isShortId('abcde')).toBe(false)
    expect(isShortId('abcdefg')).toBe(false)
    expect(isShortId('')).toBe(false)
    expect(isShortId('abc-de')).toBe(false)
  })
})

/*
 * This is the app's untrusted boundary. Everything downstream computes geometry straight from these
 * fields: the SVG height is `stemHeight + 80` and the petals are `Array.from({length: petalCount})`.
 * A missing field there is not an error, it is NaN, and React renders a NaN attribute with only a
 * warning. The result is a black smudge where a flower should be, on the one screen this app is for.
 */
describe('drawableFlower', () => {
  it('leaves a well-formed flower untouched', () => {
    expect(drawableFlower(GOOD)).toEqual(GOOD)
  })

  it('substitutes a drawable value for every field that would compute to NaN', () => {
    const repaired = drawableFlower({ ...GOOD, petalCount: NaN, stemHeight: NaN })
    expect(repaired.petalCount).toBe(8)
    expect(repaired.stemHeight).toBe(90)
  })

  it('replaces colours that are not hex rather than passing them to fill', () => {
    const repaired = drawableFlower({
      ...GOOD,
      petalColors: ['red', 'rgb(0,0,0)', 'nope'] as unknown as [string, string, string],
      centerColor: 'goldenrod',
      stemColor: '',
    })
    expect(repaired.petalColors.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
    expect(repaired.centerColor).toMatch(/^#[0-9a-f]{6}$/i)
    expect(repaired.stemColor).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('keeps the hex colours it can and only fills in from empty', () => {
    const partial = drawableFlower({
      ...GOOD,
      petalColors: ['#123456', 'not-a-colour', '#abcdef'] as unknown as [string, string, string],
    })
    expect(partial.petalColors).toContain('#123456')
    expect(partial.petalColors).not.toContain('not-a-colour')
  })

  it('falls back to a known shape rather than an unrenderable one', () => {
    const repaired = drawableFlower({ ...GOOD, petalShape: 'spiral' as never })
    expect(repaired.petalShape).toBe('round')
  })

  it('caps a petal count that would overlap itself and rejects zero', () => {
    expect(drawableFlower({ ...GOOD, petalCount: 500 }).petalCount).toBe(8)
    expect(drawableFlower({ ...GOOD, petalCount: 0 }).petalCount).toBe(8)
    expect(drawableFlower({ ...GOOD, petalCount: -3 }).petalCount).toBe(8)
  })

  it('gives a nameless flower a name, because the legend renders one either way', () => {
    expect(drawableFlower({ ...GOOD, name: '   ' }).name).toBe('a flower')
    expect(drawableFlower({ ...GOOD, meaning: undefined as never }).meaning).toBe('')
  })
})

describe('drawableGarden', () => {
  it('repairs the reply it carries as well as its own flowers', () => {
    const repaired = drawableGarden({
      flowers: [{ ...GOOD, petalCount: NaN }],
      previous: { flowers: [{ ...GOOD, stemHeight: NaN }] },
    } as never)
    expect(repaired.flowers[0]!.petalCount).toBe(8)
    expect(repaired.previous!.flowers[0]!.stemHeight).toBe(90)
  })

  it('turns a garden with no flowers array into an empty plot rather than throwing', () => {
    expect(drawableGarden({ flowers: 'nope' } as never).flowers).toEqual([])
  })
})

describe('share urls', () => {
  it('builds both views of one record from the same id', () => {
    vi.stubGlobal('window', { location: { origin: 'https://bloomnote.test' } })
    expect(buildShareUrl('kWzDsL')).toBe('https://bloomnote.test/g/kWzDsL')
    expect(buildRemixUrl('kWzDsL')).toBe('https://bloomnote.test/r/kWzDsL')
  })
})
