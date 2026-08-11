import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeFlowerJournal, loadFlowerJournal, removeFlowerJournalEntry, saveFlowerJournalEntry } from './flowerJournal'

const flower = {
  name: 'Cosmos', meaning: 'A little steadiness.', petalColors: ['#111111', '#222222', '#333333'] as [string, string, string],
  centerColor: '#444444', stemColor: '#555555', petalShape: 'round' as const, petalCount: 8, stemHeight: 90,
}

beforeEach(() => {
  const values = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
    dispatchEvent: vi.fn(),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('flower journal', () => {
  it('ignores corrupted or malformed entries', () => {
    expect(decodeFlowerJournal('{nope')).toEqual([])
    expect(decodeFlowerJournal('[{"id":3}]')).toEqual([])
  })

  it('saves one flower per garden position and updates its memory', () => {
    saveFlowerJournalEntry({ gardenId: 'garden', flowerIndex: 1, flower, memory: 'first thought' })
    saveFlowerJournalEntry({ gardenId: 'garden', flowerIndex: 1, flower, memory: 'the memory I kept' })
    expect(loadFlowerJournal()).toHaveLength(1)
    expect(loadFlowerJournal()[0]?.memory).toBe('the memory I kept')
  })

  it('removes a kept flower without touching the garden', () => {
    const entry = saveFlowerJournalEntry({ gardenId: 'garden', flowerIndex: 0, flower, memory: '' })
    removeFlowerJournalEntry(entry.id)
    expect(loadFlowerJournal()).toEqual([])
  })
})
