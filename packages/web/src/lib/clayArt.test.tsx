import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { Resvg } from '@resvg/resvg-js'
import FlowerSVG, { FlowerHead } from '../components/FlowerSVG'
import { ShareImage, PressedFlowerImage, GardenDuetImage } from './imageCards'
import { drawableGarden, type FlowerSpec } from '../garden'
import { backupGarden } from '../../../../shared/backup'

const flower: FlowerSpec = {
  artVersion: 3,
  name: 'Dahlia',
  meaning: 'Your exact meaning.',
  petalColors: ['#d993aa', '#e6b7c5', '#f3d5de'],
  centerColor: '#d9aa52',
  stemColor: '#607d56',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}
const garden = { from: 'Alex', to: 'Sam', message: 'My exact words.', bouquetNote: '', flowers: [flower] }

describe('soft clay gifts', () => {
  it('repairs incomplete saved palettes before building paints', () => {
    const partial = { ...flower, petalColors: ['#d993aa'] } as unknown as FlowerSpec
    const svg = render(<ShareImage flowers={[partial]} />)
    expect(svg).toContain('data-clay="dahlia"')
    expect(svg).not.toMatch(/NaN|undefined/)
    expect(() => new Resvg(svg).render()).not.toThrow()
  })
  it('preserves mixed art versions and original replies through portable backups and reads', () => {
    const mixed = {
      ...garden,
      flowers: [flower, { ...flower, artVersion: 2 as const }],
      previous: { ...garden, flowers: [{ ...flower, artVersion: undefined }] },
    }
    for (const copy of [backupGarden(mixed), drawableGarden(mixed)]) {
      expect(copy.flowers.map((f) => f.artVersion)).toEqual([3, 2])
      expect(copy.previous!.flowers[0]!.artVersion).toBeUndefined()
      expect(copy.message).toBe(mixed.message)
      expect(copy.flowers[0]!.meaning).toBe(flower.meaning)
    }
  })

  it.each(['Dahlia', 'Cosmos', 'Sunflower', 'Rose', 'Bluebell', 'Hydrangea', 'An unusual flower'])(
    'renders %s with self-contained paints in the live, miniature and keepsake paths',
    (name) => {
      const spec = { ...flower, name }
      for (const image of [
        <FlowerSVG key="scene" flower={spec} index={0} bloomed staticRender />,
        <FlowerHead key="head" flower={spec} />,
        <ShareImage key="share" flowers={[spec]} from="Alex" to="Sam" />,
        <PressedFlowerImage key="pressed" flower={spec} meaning={spec.meaning} />,
        <GardenDuetImage key="duet" previous={garden} current={{ ...garden, flowers: [spec] }} />,
      ]) {
        const markup = render(image)
        expect(markup).toContain('data-clay=')
        expect(markup).not.toMatch(/NaN|Infinity|animation:.*infinite/)
        const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
        expect(new Set(ids).size).toBe(ids.length)
        for (const [, reference] of markup.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(reference)
      }
    },
  )

  it('rasterizes the actual SVG paints at thumbnail size and keeps petals inside their envelope', () => {
    const markup = render(<FlowerHead flower={flower} size={120} />).replace(
      '<svg ',
      '<svg xmlns="http://www.w3.org/2000/svg" ',
    )
    const pixels = new Resvg(markup).render().pixels
    let opaque = 0
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 100) opaque++
    expect(opaque).toBeGreaterThan(1800)
    expect(opaque).toBeLessThan(10000)
    for (let coordinate = 0; coordinate < 120; coordinate++) {
      for (const pixel of [coordinate, 119 * 120 + coordinate, coordinate * 120, coordinate * 120 + 119])
        expect(pixels[pixel * 4 + 3]).toBeLessThan(32)
    }
  })
})
