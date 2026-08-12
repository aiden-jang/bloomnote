import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FlowerJournalEntry } from './flowerJournal'
import { gardenRecap } from './gardenRecap'
import { isQuiet, setQuiet, toggleQuiet } from './quietMode'

/*
 * The recap is the feature most likely to drift into a scoreboard.
 *
 * Every instinct for "weekly recap" points at counting: entries this week, versus last week, longest run.
 * That version turns a journal into something you can be behind on, which is the one thing bloomnote is
 * built not to be. So the tests here are mostly about what the output must never contain.
 */

const NOW = new Date('2026-08-20T12:00:00.000Z')

let n = 0
function entry(memory: string, daysAgo = 0): FlowerJournalEntry {
  n += 1
  return {
    id: `e${n}`,
    gardenId: `g${n}`,
    flowerIndex: 0,
    flowerName: 'Hydrangea',
    meaning: 'for the rain',
    colors: ['#e11d48'],
    memory,
    savedAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  }
}

describe('the recap', () => {
  it('names what recurred', () => {
    const recap = gardenRecap([entry('I saw Nadia.', 1), entry('Nadia called.', 3)], NOW)
    expect(recap.line).toBe('lately, Nadia kept coming up.')
  })

  it('joins people, places and feelings into one sentence', () => {
    const recap = gardenRecap(
      [
        entry('Nadia and I ate at Roberta. I was tired.', 1),
        entry('Nadia again, at Roberta. still tired.', 2),
      ],
      NOW,
    )
    expect(recap.line).toMatch(/^lately, Nadia kept coming up/)
    expect(recap.line).toContain('Roberta')
    expect(recap.line).toContain('tired')
  })

  it('only looks at the recent window', () => {
    // A thread from months ago is not what has been on somebody's mind lately.
    const recap = gardenRecap([entry('I saw Nadia.', 200), entry('Nadia called.', 190)], NOW)
    expect(recap.entryCount).toBe(0)
    expect(recap.line).toBeNull()
  })

  /*
   * The sentence this feature must never produce.
   *
   * "You wrote 3 times but nothing repeated" is a report card with the numbers filed off. Saying nothing
   * is correct: there is no pattern yet, and filling the space invents one.
   */
  it('says nothing when there are entries but no pattern', () => {
    const recap = gardenRecap([entry('a quiet day.', 1), entry('another quiet one.', 2)], NOW)
    expect(recap.entryCount).toBe(2)
    expect(recap.line).toBeNull()
  })

  it('says nothing on an empty journal', () => {
    expect(gardenRecap([], NOW).line).toBeNull()
  })

  it('never mentions cadence, streaks or comparisons', () => {
    // The whole guard. If any of this vocabulary appears, the recap has become a scoreboard.
    const many = [
      entry('Nadia and Theo, at Roberta. tired but grateful.', 1),
      entry('Nadia again. Theo too. tired.', 2),
      entry('Roberta with Theo. grateful.', 5),
      entry('Nadia. grateful.', 9),
    ]
    const line = gardenRecap(many, NOW).line ?? ''
    expect(line).not.toMatch(/streak|day|week|month|row|consecutive|missed|behind|more than|less than|last week/i)
    // No bare numbers either: "3 entries" is a tally wearing a sentence.
    expect(line).not.toMatch(/\d/)
  })

  it('caps how many it lists, so the sentence stays a sentence', () => {
    const crowd = [
      entry('Nadia, Theo, Mira, Sam and Kit were there.', 1),
      entry('Nadia, Theo, Mira, Sam and Kit again.', 2),
    ]
    const line = gardenRecap(crowd, NOW).line ?? ''
    // Three names is a sentence; five is a list.
    expect((line.match(/Nadia|Theo|Mira|Sam|Kit/g) ?? []).length).toBeLessThanOrEqual(3)
  })
})

describe('quiet mode', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function fakeStorage(overrides: Partial<Storage> = {}): Storage {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      get length() {
        return map.size
      },
      ...overrides,
    } as Storage
  }

  it('is quiet by default', () => {
    // The person who most needs the counts gone is the least likely to go looking for a setting.
    vi.stubGlobal('localStorage', fakeStorage())
    expect(isQuiet()).toBe(true)
  })

  it('only an explicit opt-out turns the numbers on', () => {
    vi.stubGlobal('localStorage', fakeStorage())
    expect(setQuiet(false)).toBe(false)
    expect(isQuiet()).toBe(false)
    expect(toggleQuiet()).toBe(true)
    expect(isQuiet()).toBe(true)
  })

  it('stays quiet when storage is unavailable', () => {
    // Private mode throws rather than no-ops, and the safe fallback is the gentler one.
    const boom = (): never => {
      throw new Error('private mode')
    }
    vi.stubGlobal('localStorage', fakeStorage({ getItem: boom, setItem: boom }))
    expect(isQuiet()).toBe(true)
    expect(() => setQuiet(false)).not.toThrow()
  })

  it('stays quiet on junk in the key', () => {
    const storage = fakeStorage()
    storage.setItem('bloomnote.quiet.v1', 'banana')
    vi.stubGlobal('localStorage', storage)
    expect(isQuiet()).toBe(true)
  })
})
