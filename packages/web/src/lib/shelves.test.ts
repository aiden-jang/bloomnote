import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  decodeFlowerJournal,
  loadFlowerJournal,
  saveFlowerJournalEntry,
  setEntryMeaning,
  setEntryShelves,
  type FlowerJournalEntry,
} from './flowerJournal'
import { entriesOn, isOn, meaningOf, SHELVES, shelvesOf, toggled } from './shelves'

const entry = (over: Partial<FlowerJournalEntry> = {}): FlowerJournalEntry => ({
  id: 'g1:0',
  gardenId: 'g1',
  flowerIndex: 0,
  flowerName: 'peony',
  meaning: 'a good year',
  colors: ['#f9a8d4'],
  memory: 'the week of the move',
  savedAt: '2026-08-01T10:00:00.000Z',
  ...over,
})

// No jsdom in this project, so storage is stubbed the same way flowerJournal.test.ts does it.
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

describe('putting a flower on a shelf', () => {
  it('starts on neither', () => {
    expect(shelvesOf(entry())).toEqual([])
  })

  /*
   * Both shelves at once, on purpose.
   *
   * One field forcing a choice would make these categories, and the thing somebody survived is very
   * often the thing they most want to remember.
   */
  it('holds a flower on both at once', () => {
    const both = entry({ shelves: ['survived', 'remember'] })
    expect(isOn(both, 'survived')).toBe(true)
    expect(isOn(both, 'remember')).toBe(true)
  })

  it('adds and removes one without disturbing the other', () => {
    const one = entry({ shelves: ['remember'] })
    expect(toggled(one, 'survived')).toEqual(['survived', 'remember'])
    expect(toggled(entry({ shelves: ['survived', 'remember'] }), 'survived')).toEqual(['remember'])
  })

  it('keeps a stable order however they were added', () => {
    // Or the chips reorder themselves under the reader's finger when one is tapped.
    expect(shelvesOf(entry({ shelves: ['remember', 'survived'] }))).toEqual(['survived', 'remember'])
  })

  it('ignores a shelf name it does not have', () => {
    // Storage is a string array from another device or an older build, not a validated enum.
    expect(shelvesOf(entry({ shelves: ['survived', 'nonsense'] }))).toEqual(['survived'])
  })

  it('survives storage holding something that is not a list', () => {
    expect(shelvesOf(entry({ shelves: 'survived' as unknown as string[] }))).toEqual([])
  })

  it('collects what is on each shelf', () => {
    const all = [
      entry({ id: 'a', shelves: ['survived'] }),
      entry({ id: 'b', shelves: ['survived', 'remember'] }),
      entry({ id: 'c' }),
    ]
    expect(entriesOn(all, 'survived').map((e) => e.id)).toEqual(['a', 'b'])
    expect(entriesOn(all, 'remember').map((e) => e.id)).toEqual(['b'])
  })
})

describe('what it means to you', () => {
  it('shows the sender’s meaning until you write your own', () => {
    expect(meaningOf(entry())).toEqual({ text: 'a good year', mine: false })
  })

  it('prefers yours once there is one', () => {
    expect(meaningOf(entry({ mine: 'the day it finally stopped' }))).toEqual({
      text: 'the day it finally stopped',
      mine: true,
    })
  })

  it('does not treat whitespace as a meaning', () => {
    expect(meaningOf(entry({ mine: '   ' })).mine).toBe(false)
  })

  /*
   * The sender's meaning is never overwritten.
   *
   * It came with somebody else's message. Storing yours in the same field would edit what they said,
   * and there would be no way back to it.
   */
  it('keeps the sender’s alongside yours', () => {
    const both = entry({ mine: 'mine' })
    expect(both.meaning).toBe('a good year')
    expect(meaningOf(both).text).toBe('mine')
  })
})

describe('the shelves are named, not typed in', () => {
  it('offers exactly two', () => {
    // A taxonomy somebody maintains is admin, which is the opposite of a keepsake shelf.
    expect(SHELVES).toHaveLength(2)
  })

  it('says something kind when one is empty rather than nudging', () => {
    for (const shelf of SHELVES) {
      expect(shelf.empty, shelf.id).not.toMatch(/start|add|why not|you should|streak|keep going/i)
    }
  })
})

describe('storing it', () => {
  /*
   * The trap this whole feature could have shipped with.
   *
   * `decodeFlowerJournal` validates each entry's shape and silently drops the ones that fail. Making
   * `shelves` or `mine` required there would have emptied the journal of every flower kept before this
   * existed, on first load, with no error anywhere.
   */
  it('does not drop flowers kept before shelves existed', () => {
    const old = JSON.stringify([{ ...entry() }])
    const decoded = decodeFlowerJournal(old)
    expect(decoded).toHaveLength(1)
    expect(shelvesOf(decoded[0]!)).toEqual([])
    expect(meaningOf(decoded[0]!).mine).toBe(false)
  })

  it('round-trips a shelf through storage', () => {
    saveFlowerJournalEntry({
      gardenId: 'g1',
      flowerIndex: 0,
      flower: { name: 'peony', meaning: 'a good year', petalColors: ['#f9a8d4'] } as never,
      memory: 'the week of the move',
    })
    expect(setEntryShelves('g1:0', ['survived'])).toBe(true)
    expect(shelvesOf(loadFlowerJournal()[0]!)).toEqual(['survived'])
  })

  it('round-trips your own meaning, and clearing it brings the sender’s back', () => {
    saveFlowerJournalEntry({
      gardenId: 'g1',
      flowerIndex: 0,
      flower: { name: 'peony', meaning: 'a good year', petalColors: ['#f9a8d4'] } as never,
      memory: 'the week of the move',
    })
    setEntryMeaning('g1:0', 'the day it finally stopped')
    expect(meaningOf(loadFlowerJournal()[0]!)).toEqual({ text: 'the day it finally stopped', mine: true })

    setEntryMeaning('g1:0', '')
    expect(meaningOf(loadFlowerJournal()[0]!)).toEqual({ text: 'a good year', mine: false })
  })

  it('removes the field when you clear it rather than storing an empty one', () => {
    // Same result through meaningOf either way, so this is about the stored shape: eighty entries each
    // carrying a dead key is eighty keys of nothing in a bounded localStorage budget.
    saveFlowerJournalEntry({
      gardenId: 'g1',
      flowerIndex: 0,
      flower: { name: 'peony', meaning: 'a good year', petalColors: ['#f9a8d4'] } as never,
      memory: 'x',
    })
    setEntryMeaning('g1:0', 'something')
    setEntryMeaning('g1:0', '')
    expect('mine' in loadFlowerJournal()[0]!).toBe(false)
  })

  it('caps your meaning so the journal cannot grow without bound', () => {
    saveFlowerJournalEntry({
      gardenId: 'g1',
      flowerIndex: 0,
      flower: { name: 'peony', meaning: 'a good year', petalColors: ['#f9a8d4'] } as never,
      memory: 'x',
    })
    setEntryMeaning('g1:0', 'z'.repeat(500))
    expect(meaningOf(loadFlowerJournal()[0]!).text).toHaveLength(240)
  })

  it('reports an id that is not on the shelf rather than writing a new one', () => {
    expect(setEntryShelves('nothing:0', ['survived'])).toBe(false)
    expect(loadFlowerJournal()).toHaveLength(0)
  })

  it('leaves the rest of the entry alone', () => {
    saveFlowerJournalEntry({
      gardenId: 'g1',
      flowerIndex: 0,
      flower: { name: 'peony', meaning: 'a good year', petalColors: ['#f9a8d4'] } as never,
      memory: 'the week of the move',
      from: 'Sam',
    })
    setEntryShelves('g1:0', ['remember'])
    const saved = loadFlowerJournal()[0]!
    expect(saved.memory).toBe('the week of the move')
    expect(saved.from).toBe('Sam')
    expect(saved.savedAt).toBeTruthy()
  })
})
