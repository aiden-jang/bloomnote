/*
 * The exported cards, checked as the SVG they produce.
 *
 * These images leave the app: they go into somebody's photo roll and into a link preview a stranger
 * sees. Nothing else here renders them, and a canvas cannot run in this suite, so the markup one
 * step before rasterizing is the last place a mistake is catchable.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { duetLabel, OgCard, PressedFlowerImage, ShareImage, soilPaths, wrapMeaning } from './imageCards'
import { warmKey } from './gardenImage'
import type { FlowerSpec } from '../garden'

const flower = (over: Partial<FlowerSpec> = {}): FlowerSpec => ({
  name: 'Hydrangea',
  meaning: 'For four hours in the rain.',
  petalColors: ['#6f8fd0', '#8fa8dd', '#b3c4ea'],
  centerColor: '#f0c674',
  stemColor: '#5f8a52',
  petalShape: 'round',
  petalCount: 9,
  stemHeight: 96,
  ...over,
})

describe('wrapMeaning', () => {
  it('breaks on words, never mid-word', () => {
    for (const line of wrapMeaning('for the drive and for not making it a big deal at all', 20)) {
      expect(line).not.toMatch(/^\s|\s$/)
      expect(line.length).toBeLessThanOrEqual(20 + 12)
    }
  })

  /*
   * Four lines is the space the card reserves. A fifth would render underneath the layout rather
   * than pushing it, so a long meaning has to be cut here rather than trusted to fit.
   */
  it('never returns more than four lines however long the meaning', () => {
    expect(wrapMeaning('word '.repeat(200), 20)).toHaveLength(4)
  })

  it('keeps every word when the meaning is short', () => {
    expect(wrapMeaning('short and sweet', 40).join(' ')).toBe('short and sweet')
  })

  it('handles an empty meaning without producing a blank line', () => {
    expect(wrapMeaning('   ', 20).join('')).toBe('')
  })
})

describe('duetLabel', () => {
  it('reads as a direction when both names are there', () => {
    expect(duetLabel({ flowers: [], from: 'Aiden', to: 'Nadia' } as never)).toBe('Aiden → Nadia')
  })

  it('falls back through from, to, and neither', () => {
    expect(duetLabel({ flowers: [], from: 'Aiden' } as never)).toBe('from Aiden')
    expect(duetLabel({ flowers: [], to: 'Nadia' } as never)).toBe('for Nadia')
    expect(duetLabel({ flowers: [] } as never)).toBe('a little garden')
  })

  /* Names allow 60 characters and this label is one non-wrapping line, so it has to be clipped. */
  it('clips a long name rather than letting it run off the card', () => {
    const label = duetLabel({ flowers: [], from: 'A'.repeat(60), to: 'B'.repeat(60) } as never)
    expect(label).toContain('…')
    expect(label.length).toBeLessThan(40)
  })
})

describe('warmKey', () => {
  /*
   * The key decides whether a pre-rendered PNG is reused. Too loose and somebody shares the
   * previous garden's picture; too tight and the prewarm never hits and `navigator.share` loses
   * its user gesture waiting for a render.
   */
  it('matches the same garden and differs on anything that changes the picture', () => {
    const base = { flowers: [flower()], from: 'Aiden', to: 'Nadia' }
    expect(warmKey(base)).toBe(warmKey({ ...base }))
    expect(warmKey(base)).not.toBe(warmKey({ ...base, to: 'Theo' }))
    expect(warmKey(base)).not.toBe(warmKey({ ...base, flowers: [flower({ name: 'Dahlia' })] }))
    expect(warmKey(base)).not.toBe(warmKey({ ...base, flowers: [flower({ stemHeight: 60 })] }))
    expect(warmKey(base)).not.toBe(
      warmKey({ ...base, flowers: [flower({ petalColors: ['#000000', '#111111', '#222222'] })] }),
    )
  })
})

describe('soilPaths', () => {
  it('produces path data rather than NaN at every card width', () => {
    for (const [x, w, surface, bottom] of [
      [0, 1080, 800, 1080],
      [0, 1200, 430, 630],
      [40, 320, 300, 420],
    ]) {
      for (const d of Object.values(soilPaths(x!, w!, surface!, bottom!))) {
        expect(d).not.toMatch(/NaN|undefined/)
      }
    }
  })
})

/*
 * Rendered markup, not a canvas. jsdom has no 2D context and the suite runs in Node, so rasterize
 * itself cannot be exercised here. What can be is the SVG it is handed, which is where a missing
 * field turns into the black smudge the repair path exists to prevent.
 */
describe('the rendered cards', () => {
  const opts = { flowers: [flower(), flower({ name: 'Dahlia' })], from: 'Aiden', to: 'Nadia' }

  it('renders the square card with both names and no NaN geometry', () => {
    const svg = renderToStaticMarkup(<ShareImage {...opts} />)
    expect(svg).not.toMatch(/NaN/)
    expect(svg).toContain('Aiden')
    expect(svg).toContain('Nadia')
  })

  it('renders the link preview card without NaN geometry', () => {
    const svg = renderToStaticMarkup(<OgCard {...opts} />)
    expect(svg).not.toMatch(/NaN/)
  })

  it('renders a single pressed flower without NaN geometry, broken spec included', () => {
    expect(
      renderToStaticMarkup(<PressedFlowerImage flower={flower()} meaning="for the drive." />),
    ).not.toMatch(/NaN/)
    const broken = { ...flower(), petalCount: NaN, stemHeight: NaN } as FlowerSpec
    expect(renderToStaticMarkup(<PressedFlowerImage flower={broken} meaning="x" />)).not.toMatch(/NaN/)
  })

  it('renders the link preview card from a broken spec without NaN geometry', () => {
    const broken = { ...flower(), stemHeight: NaN } as FlowerSpec
    expect(renderToStaticMarkup(<OgCard flowers={[broken]} from="Aiden" to="Nadia" />)).not.toMatch(/NaN/)
  })

  /*
   * The repair path exists because a missing field computes to NaN and React renders a NaN
   * attribute with only a warning, which draws as a black smudge. These images are the one place
   * that smudge would leave the app, so the cards must not emit NaN even from a broken spec.
   */
  it('emits no NaN geometry even when a flower is missing its numbers', () => {
    const broken = { ...flower(), petalCount: NaN, stemHeight: NaN } as FlowerSpec
    const svg = renderToStaticMarkup(<ShareImage flowers={[broken]} from="Aiden" to="Nadia" />)
    expect(svg).not.toMatch(/NaN/)
  })
})
