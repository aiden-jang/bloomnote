import { afterEach, expect, test, vi } from 'vitest'
import { generateGarden } from '../src/designGarden.js'

const flower = {
  name: 'Poppy',
  meaning: 'For the Sunday pancakes, including the burnt one.',
  petalColors: ['#eeeeee', '#f5f5f5', '#ffffff'],
  centerColor: '#d9ac50',
  stemColor: '#78905b',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}

function modelReply(change: Record<string, unknown>) {
  const garden = {
    bouquet_note: 'Thinking of those Sunday mornings with you.',
    flowers: [{ ...flower, ...change }, flower, flower],
  }
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        candidates: [{ content: { parts: [{ functionCall: { name: 'design_garden', args: garden } }] } }],
      }),
    ),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

afterEach(() => vi.unstubAllGlobals())

test.each([
  { input: { petalCount: 4, stemHeight: 60 }, expected: { petalCount: 5, stemHeight: 70 } },
  { input: { petalCount: 18, stemHeight: 140 }, expected: { petalCount: 14, stemHeight: 115 } },
])('keeps model prose when drawing numbers exceed renderer bounds: $input', async ({ input, expected }) => {
  const fetch = modelReply(input)
  const result = await generateGarden('synthetic-key', 'synthetic note')
  expect(result.flowers[0]).toMatchObject({ ...expected, meaning: flower.meaning })
  expect(result.bouquet_note).toBe('Thinking of those Sunday mornings with you.')
  expect(fetch).toHaveBeenCalledTimes(1)
})

test.each([{ petalCount: 'four' }, { centerColor: 'url(https://example.test)' }, { petalShape: 'spiky' }])(
  'still rejects malformed model fields: %j',
  async (change) => {
    modelReply(change)
    await expect(generateGarden('synthetic-key', 'synthetic note')).rejects.toThrow()
  },
)
