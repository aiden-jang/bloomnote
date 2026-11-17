import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup as render } from 'react-dom/server'
import FlowerSVG, { FlowerHead } from '../components/FlowerSVG'
import GiftPacket from '../components/GiftPacket'
import { botanicalFamily } from '../components/BotanicalFlower'
import { GardenDuetImage, ShareImage, PressedFlowerImage } from './imageCards'
import { backupGarden } from '../../../../shared/backup'
import { designGarden } from './designGarden'
import { drawableGarden, type FlowerSpec } from '../garden'

const flower: FlowerSpec = {
  name: 'Rose',
  meaning: 'The sender’s own meaning.',
  petalColors: ['#cc8596', '#e7b4bf', '#f1d0d5'],
  centerColor: '#d1a34b',
  stemColor: '#718b61',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}
const garden = { from: 'Alex', to: 'Sam', message: 'My exact words.', bouquetNote: '', flowers: [flower] }
afterEach(() => vi.unstubAllGlobals())

describe('versioned botanical art', () => {
  it('keeps old gifts on their original renderer through reads and portable backups', () => {
    for (const copy of [garden, drawableGarden(garden), backupGarden(garden)]) {
      expect(copy.flowers[0]).not.toHaveProperty('artVersion')
      const markup = render(<FlowerSVG flower={copy.flowers[0]!} index={0} bloomed staticRender />)
      expect(markup).not.toContain('data-botanical')
    }
    const modern = { ...garden, flowers: [{ ...flower, artVersion: 2 as const }] }
    expect(backupGarden(modern).flowers[0]).toEqual(modern.flowers[0])
    expect(drawableGarden(modern).flowers[0]).toEqual(modern.flowers[0])
  })

  it.each(['Dahlia', 'Cosmos', 'Sunflower', 'Rose', 'Bluebell', 'Hydrangea'])(
    'uses the same %s geometry in scenes, specimens and exports',
    (name) => {
      const spec = { ...flower, name, artVersion: 2 as const }
      const marker = `data-botanical="${name.toLowerCase()}"`
      for (const content of [
        <FlowerSVG key="scene" flower={spec} index={0} bloomed staticRender />,
        <FlowerHead key="specimen" flower={spec} />,
        <ShareImage key="share" flowers={[spec]} from="Alex" to="Sam" />,
        <PressedFlowerImage key="pressed" flower={spec} meaning={spec.meaning} />,
        <GardenDuetImage key="duet" previous={garden} current={{ ...garden, flowers: [spec] }} />,
      ]) {
        const svg = render(content)
        expect(svg).toContain(marker)
        expect(svg).toContain(spec.petalColors[0])
        expect(svg).not.toMatch(/NaN|Infinity|animation:.*infinite/)
      }
    },
  )

  it('gives unfamiliar names an attractive fallback without renaming their flower', () => {
    const spec = { ...flower, name: 'An unusual flower', artVersion: 2 as const }
    expect(botanicalFamily(spec)).toBe('wildflower')
    expect(botanicalFamily({ ...spec, name: 'Primrose' })).toBe('wildflower')
    expect(botanicalFamily({ ...spec, petalShape: 'bell' })).toBe('bluebell')
    expect(render(<FlowerHead flower={spec} />)).toContain('data-botanical="wildflower"')
    expect(spec.name).toBe('An unusual flower')
  })

  it('marks newly designed flowers without asking the model for any new fields', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          `event: complete\ndata: ${JSON.stringify({ garden: { flowers: [flower], bouquet_note: 'A note.' } })}\n\n`,
        ),
      )
    vi.stubGlobal('fetch', fetcher)
    const result = await designGarden({ message: 'A note.', recipient: 'Sam' })
    expect(result.flowers[0]).toEqual({ ...flower, artVersion: 3 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('addresses the paper gift with real names and one keyboard-accessible open action', () => {
    const packet = render(
      <GiftPacket from="Alex & Bea" to="Sam <3" count={3} opening={false} onOpen={() => {}} />,
    )
    expect(packet).toContain('for Sam &lt;3')
    expect(packet).toContain('from Alex &amp; Bea')
    expect(packet.match(/<button/g)).toHaveLength(1)
    expect(packet).toContain('aria-label="open the garden"')
    expect(packet).toContain('3 flowers, chosen for you.')
  })
})
