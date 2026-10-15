import { afterEach, expect, it, vi } from 'vitest'
import { rememberedFeeling, sendFeeling } from './water'

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
