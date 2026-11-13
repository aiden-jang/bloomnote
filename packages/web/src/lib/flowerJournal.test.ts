import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeFlowerJournal,
  loadFlowerJournal,
  removeFlowerJournalEntry,
  saveFlowerJournalEntry,
  setEntryMeaning,
  setEntryShelves,
} from './flowerJournal'

const flower = {
  name: 'Cosmos',
  meaning: 'A little steadiness.',
  petalColors: ['#111111', '#222222', '#333333'] as [string, string, string],
  centerColor: '#444444',
  stemColor: '#555555',
  petalShape: 'round' as const,
  petalCount: 8,
  stemHeight: 90,
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

  it('reports a refused write without announcing a saved memory', () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    expect(
      saveFlowerJournalEntry({ gardenId: 'garden', flowerIndex: 0, flower, memory: 'keep this' }),
    ).toBeNull()
    expect(window.dispatchEvent).not.toHaveBeenCalled()
  })

  it('keeps personal meaning and shelves when a memory is edited', () => {
    const input = { gardenId: 'garden', flowerIndex: 0, flower, memory: 'first' }
    saveFlowerJournalEntry(input)
    setEntryMeaning('garden:0', 'A fresh start')
    setEntryShelves('garden:0', ['small-joys'])
    saveFlowerJournalEntry({ ...input, memory: 'second' })
    expect(loadFlowerJournal()[0]).toMatchObject({
      memory: 'second',
      mine: 'A fresh start',
      shelves: ['small-joys'],
    })
  })

  it('removes a kept flower without touching the garden', () => {
    const entry = saveFlowerJournalEntry({ gardenId: 'garden', flowerIndex: 0, flower, memory: '' })
    expect(entry).not.toBeNull()
    removeFlowerJournalEntry(entry!.id)
    expect(loadFlowerJournal()).toEqual([])
  })
})
