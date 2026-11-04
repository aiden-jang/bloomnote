import { afterEach, expect, it, vi } from 'vitest'
import { fetchResponsesBatch, rememberedFeeling, sendFeeling } from './water'

afterEach(() => vi.unstubAllGlobals())

it.each(['null', '[]', '7', '"old data"'])(
  'records a successful response with malformed feeling memory %s',
  async (raw) => {
    const storage = new Map([['bloomnote.feeling.v1', raw]])
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    })
    const response = { waters: 1, feelings: { love: 1 } }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
    expect(await sendFeeling('AbCdEf', 'love')).toEqual(response)
    expect(rememberedFeeling('AbCdEf')).toBe('love')
    expect(JSON.parse(storage.get('bloomnote.feeling.v1')!)).toEqual({ AbCdEf: 'love' })
  },
)

it('reads every response in a large library without exceeding the API batch limit', async () => {
  const ids = Array.from({ length: 180 }, (_, index) => `garden-${index}`)
  const requests: string[][] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const batch = new URL(url, 'https://bloomnote.test').searchParams.get('ids')!.split(',')
      requests.push(batch)
      return Response.json({
        responses: Object.fromEntries(batch.slice(0, 40).map((id) => [id, { waters: 3, feelings: {} }])),
      })
    }),
  )
  const responses = await fetchResponsesBatch([...ids, ids[0]!])
  expect(Object.keys(responses)).toEqual(ids)
  expect(requests.every((batch) => batch.length <= 40)).toBe(true)
  expect(requests.flat()).toEqual(ids)
})

it('does not publish partial totals when a later response batch fails', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ responses: { first: { waters: 9, feelings: {} } } }))
    .mockResolvedValueOnce(new Response('', { status: 503 }))
  vi.stubGlobal('fetch', fetcher)
  expect(await fetchResponsesBatch(Array.from({ length: 81 }, (_, index) => String(index)))).toEqual({})
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('stops remaining lookups when the library is left', async () => {
  const controller = new AbortController()
  const fetcher = vi.fn(async (_url: string, options: RequestInit) => {
    expect(options.signal).toBe(controller.signal)
    controller.abort()
    return Response.json({ responses: { old: { waters: 8, feelings: {} } } })
  })
  vi.stubGlobal('fetch', fetcher)
  expect(
    await fetchResponsesBatch(
      Array.from({ length: 100 }, (_, i) => String(i)),
      controller.signal,
    ),
  ).toEqual({})
  expect(fetcher).toHaveBeenCalledTimes(1)
})
