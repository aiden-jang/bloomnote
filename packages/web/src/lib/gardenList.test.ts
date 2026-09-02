import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  filterGardens,
  orderGardens,
  readPinnedGardens,
  writePinnedGardens,
  type CardData,
} from './gardenList'

const card = (id: string, over: Partial<CardData> = {}): CardData => ({
  id,
  to: 'Grace',
  from: 'Ada',
  occasion: 'birthday',
  createdAt: '2026-01-01T00:00:00.000Z',
  swatches: [],
  ...over,
})

describe('orderGardens', () => {
  const waters = { a: 1, b: 9, c: 5 }

  it('puts pinned gardens first, whatever the sort says', () => {
    // Someone who pinned a garden wants it at the top. If changing the sort moved it, the pin
    // would look broken.
    const gardens = [card('a'), card('b'), card('c')]
    expect(orderGardens(gardens, ['c'], 'watered', waters)[0]!.id).toBe('c')
    expect(orderGardens(gardens, ['c'], 'newest', waters)[0]!.id).toBe('c')
    expect(orderGardens(gardens, ['c'], 'oldest', waters)[0]!.id).toBe('c')
  })

  it('sorts newest and oldest in opposite directions', () => {
    const gardens = [
      card('old', { createdAt: '2020-01-01T00:00:00.000Z' }),
      card('new', { createdAt: '2026-06-01T00:00:00.000Z' }),
    ]
    expect(orderGardens(gardens, [], 'newest', {}).map((g) => g.id)).toEqual(['new', 'old'])
    expect(orderGardens(gardens, [], 'oldest', {}).map((g) => g.id)).toEqual(['old', 'new'])
  })

  it('falls back to date when two gardens have the same water count', () => {
    // Otherwise unwatered gardens shuffle on every render.
    const gardens = [
      card('older', { createdAt: '2020-01-01T00:00:00.000Z' }),
      card('newer', { createdAt: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(orderGardens(gardens, [], 'watered', {}).map((g) => g.id)).toEqual(['newer', 'older'])
  })

  it('sorts a received garden by when it arrived, not when it was made', () => {
    const gardens = [
      card('made-late', { createdAt: '2026-06-01T00:00:00.000Z', receivedAt: '2020-01-01T00:00:00.000Z' }),
      card('made-early', { createdAt: '2020-01-01T00:00:00.000Z', receivedAt: '2026-06-01T00:00:00.000Z' }),
    ]
    expect(orderGardens(gardens, [], 'newest', {}).map((g) => g.id)).toEqual(['made-early', 'made-late'])
  })

  it('does not reorder the caller’s array', () => {
    const gardens = [card('a'), card('b')]
    orderGardens(gardens, ['b'], 'newest', {})
    expect(gardens.map((g) => g.id)).toEqual(['a', 'b'])
  })
})

describe('filterGardens', () => {
  const gardens = [card('a', { to: 'Grace', from: 'Ada', occasion: 'birthday' })]

  it('returns everything for an empty or whitespace query', () => {
    expect(filterGardens(gardens, '')).toHaveLength(1)
    expect(filterGardens(gardens, '   ')).toHaveLength(1)
  })

  it('matches either name or the occasion, ignoring case', () => {
    for (const q of ['grace', 'ADA', 'Birth']) expect(filterGardens(gardens, q), q).toHaveLength(1)
    expect(filterGardens(gardens, 'wedding')).toHaveLength(0)
  })

  it('survives a garden with no from or occasion', () => {
    const sparse = [card('a', { from: undefined, occasion: undefined })]
    expect(() => filterGardens(sparse, 'ada')).not.toThrow()
    expect(filterGardens(sparse, 'grace')).toHaveLength(1)
  })
})

describe('pinned gardens storage', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => values.get(k) ?? null,
        setItem: (k: string, v: string) => values.set(k, v),
      },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('round-trips pinned ids', () => {
    writePinnedGardens(['a', 'b'])
    expect(readPinnedGardens()).toEqual(['a', 'b'])
  })

  it('drops non-strings rather than rendering junk as a pin', () => {
    window.localStorage.setItem('bloomnote:pinned-gardens', JSON.stringify(['a', 3, null, { id: 'b' }]))
    expect(readPinnedGardens()).toEqual(['a'])
  })

  it('returns nothing for junk, and never throws', () => {
    for (const junk of ['not json', '{}', 'null', '"a"']) {
      window.localStorage.setItem('bloomnote:pinned-gardens', junk)
      expect(readPinnedGardens(), junk).toEqual([])
    }
  })
})
