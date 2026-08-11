import { describe, expect, test } from 'vitest'
import { gardenMemoryDeck, gardenMemoryLabel } from './gardenMemories'

const now = new Date('2026-08-11T12:00:00')
const garden = (id: string, createdAt: string, unlockAt?: string) => ({ id, createdAt, unlockAt })

describe('gardenMemoryDeck', () => {
  test('puts an on-this-day garden before the ordinary daily pick', () => {
    const deck = gardenMemoryDeck([
      garden('ordinary', '2025-04-02T12:00:00Z'),
      garden('anniversary', '2024-08-11T12:00:00Z'),
      garden('another', '2025-01-03T12:00:00Z'),
    ], now)
    expect(deck[0]?.id).toBe('anniversary')
  })

  test('excludes recent, future-sealed, and malformed records', () => {
    const deck = gardenMemoryDeck([
      garden('old', '2025-01-01T12:00:00Z'),
      garden('recent', '2026-08-02T12:00:00Z'),
      garden('sealed', '2025-01-01T12:00:00Z', '2026-09-01T12:00:00Z'),
      garden('broken', 'not-a-date'),
    ], now)
    expect(deck.map((item) => item.id)).toEqual(['old'])
  })

  test('keeps one order for the day and rotates the first ordinary memory over time', () => {
    const gardens = [
      garden('a', '2025-01-01T12:00:00Z'),
      garden('b', '2025-02-01T12:00:00Z'),
      garden('c', '2025-03-01T12:00:00Z'),
    ]
    expect(gardenMemoryDeck(gardens, now)).toEqual(gardenMemoryDeck(gardens, now))
    expect(gardenMemoryDeck(gardens, now)[0]?.id).not.toBe(
      gardenMemoryDeck(gardens, new Date('2026-08-12T12:00:00'))[0]?.id,
    )
  })
})

describe('gardenMemoryLabel', () => {
  test('calls out anniversaries and uses human age copy otherwise', () => {
    expect(gardenMemoryLabel('2024-08-11T12:00:00', now)).toBe('on this day, 2 years ago')
    expect(gardenMemoryLabel('2026-07-12T12:00:00', now)).toBe('30 days ago')
    expect(gardenMemoryLabel('2026-04-11T12:00:00', now)).toBe('4 months ago')
  })
})
