import { afterEach, expect, it, vi } from 'vitest'
import { renderToStaticMarkup as render } from 'react-dom/server'
import { Resvg } from '@resvg/resvg-js'
import GardenBee from '../components/GardenBee'
import ClayBee from '../components/ClayBee'
import Watering from '../components/Watering'
import { placeFlowers } from './scene'
import type { FlowerSpec } from '../garden'

const flower: FlowerSpec = {
  artVersion: 3,
  name: 'Cosmos',
  meaning: 'For being here.',
  petalColors: ['#b8a0cf', '#cebddf', '#e2d5ec'],
  centerColor: '#d9ac50',
  stemColor: '#78905b',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}
const bee = (occasion?: string, clay = true) =>
  render(<GardenBee placements={placeFlowers([flower])} active clay={clay} occasion={occasion} />)
const reactions = (occasion?: string) =>
  render(<Watering gardenId="AbCdEf" occasion={occasion} onWatered={() => {}} />)
afterEach(() => vi.unstubAllGlobals())

it('offers all feelings and water independently on a newly opened ordinary garden', () => {
  const html = reactions('birthday')
  for (const text of ['love', 'comfort', 'joy', 'a hug', 'water it']) expect(html).toContain(text)
  expect(html).toContain('role="group"')
  expect(html).not.toContain('you watered it')
})

it.each(['sympathy', 'get-well'])('keeps %s quiet and omits joy', (occasion) => {
  expect(bee(occasion)).toBe('')
  const html = reactions(occasion)
  expect(html).toContain('comfort')
  expect(html).toContain('a hug')
  expect(html).not.toContain('joy')
  expect(html).toContain('data-gentle="true"')
})

it('remembers a feeling without spending the watering gesture', () => {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'bloomnote.feeling.v1' ? '{"AbCdEf":"hug"}' : null),
  })
  const html = reactions('birthday')
  expect(html).toContain('sent back a tiny hug')
  expect(html).toContain('water it')
  expect(html).not.toContain('send a feeling back')
})

it('reserves the hat for ordinary clay gifts, retaining a static button with reduced motion', () => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
  const html = bee('birthday')
  expect(html).toContain('aria-label="give the bee a petal hat"')
  expect(html).toContain('data-resting="true"')
  for (const occasion of [undefined, 'unknown', 'sympathy', 'get-well']) {
    expect(bee(occasion)).not.toContain('<button')
  }
  expect(bee('birthday', false)).toBe('')
})

it('renders the real petal hat with valid scoped paints', () => {
  const markup = render(<ClayBee hat petalColor="#b8a0cf" />).replace(
    '<svg ',
    '<svg xmlns="http://www.w3.org/2000/svg" ',
  )
  expect(markup).toContain('data-petal-hat')
  expect(markup).toContain('#b8a0cf')
  const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])
  for (const [, reference] of markup.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(reference)
  expect(() => new Resvg(markup).render()).not.toThrow()
})
