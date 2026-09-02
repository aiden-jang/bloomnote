/*
 * The modules small enough that a file each would be more ceremony than test.
 *
 * Grouped rather than skipped: each one is a boundary the rest of the app trusts silently, and none
 * of them had a test before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardBloom } from './cardBloom'
import { formatGardenDate } from './formatDate'
import { isQuiet, setQuiet, toggleQuiet } from './quietMode'
import { placeholderFor, placeholderOptions } from './placeholders'
import { OCCASIONS, DEFAULT_OCCASION, labelFor } from './occasions'
import { MOODS, DEFAULT_MOOD } from './moods'

afterEach(() => vi.unstubAllGlobals())

describe('cardBloom', () => {
  /* An archive card that redraws itself differently on every render reads as a glitch. */
  it('draws the same flower for the same garden and slot every time', () => {
    const a = cardBloom('#6f8fd0', 'kWzDsL', 0)
    const b = cardBloom('#6f8fd0', 'kWzDsL', 0)
    expect(a).toEqual(b)
  })

  it('varies the silhouette across slots so a row is not five identical flowers', () => {
    const shapes = new Set([0, 1, 2, 3, 4].map((i) => cardBloom('#6f8fd0', 'kWzDsL', i).petalShape))
    expect(shapes.size).toBeGreaterThan(1)
  })

  it('keeps the real colour and derives the gradient from it', () => {
    const bloom = cardBloom('#6f8fd0', 'kWzDsL', 0)
    expect(bloom.petalColors[0]).toBe('#6f8fd0')
    expect(bloom.petalColors[1]).not.toBe(bloom.petalColors[0])
    expect(bloom.petalColors.every((c) => /^#[0-9a-f]{6}$/i.test(c))).toBe(true)
  })

  it('leaves a colour it cannot parse alone rather than emitting NaN hex', () => {
    const bloom = cardBloom('goldenrod', 'kWzDsL', 0)
    expect(bloom.petalColors).toEqual(['goldenrod', 'goldenrod', 'goldenrod'])
  })

  it('stays inside the petal count the renderer is laid out for', () => {
    for (let i = 0; i < 30; i += 1) {
      const count = cardBloom('#6f8fd0', `garden-${i}`, i).petalCount
      expect(count).toBeGreaterThanOrEqual(7)
      expect(count).toBeLessThanOrEqual(12)
    }
  })
})

describe('formatGardenDate', () => {
  it('returns null rather than "Invalid Date" for anything unusable', () => {
    expect(formatGardenDate(undefined)).toBeNull()
    expect(formatGardenDate('')).toBeNull()
    expect(formatGardenDate('not a date')).toBeNull()
  })

  it('formats a stored ISO timestamp as a readable day', () => {
    const formatted = formatGardenDate('2026-08-20T10:00:00.000Z')
    expect(formatted).toBeTruthy()
    expect(formatted).toMatch(/2026/)
  })
})

describe('quiet mode', () => {
  function stubLocalStorage(seed?: string) {
    const store = new Map<string, string>()
    if (seed !== undefined) store.set('bloomnote.quiet.v1', seed)
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    })
    vi.stubGlobal('dispatchEvent', vi.fn())
    vi.stubGlobal('Event', class {})
    return store
  }

  /*
   * Quiet is the default, and it is the opposite of what most apps do. Only an explicit opt-out
   * turns the tallies on, so a cleared store, a new device and a broken store all stay quiet.
   */
  it('stays quiet unless somebody has explicitly asked for numbers', () => {
    stubLocalStorage()
    expect(isQuiet()).toBe(true)
    stubLocalStorage('on')
    expect(isQuiet()).toBe(true)
    stubLocalStorage('off')
    expect(isQuiet()).toBe(false)
  })

  it('stays quiet when the store throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('private mode')
      },
    })
    expect(isQuiet()).toBe(true)
  })

  it('returns the new state so a caller need not read it back', () => {
    stubLocalStorage()
    expect(setQuiet(false)).toBe(false)
    expect(isQuiet()).toBe(false)
    expect(toggleQuiet()).toBe(true)
  })

  it('still reports the new state when the write fails', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota')
      },
    })
    vi.stubGlobal('dispatchEvent', vi.fn())
    vi.stubGlobal('Event', class {})
    expect(setQuiet(false)).toBe(false)
  })
})

describe('placeholders', () => {
  /* The one structural rule: without a `default`, an unlisted mood renders an empty field. */
  it('gives every occasion a default note', () => {
    for (const { value } of OCCASIONS) {
      expect(placeholderFor(value, 'no-such-mood')).toBeTruthy()
    }
  })

  it('falls back to the default occasion for one it does not know', () => {
    expect(placeholderFor('halloween', DEFAULT_MOOD)).toBe(placeholderFor(DEFAULT_OCCASION, DEFAULT_MOOD))
  })

  it('leads the rotation with the mood that was actually chosen', () => {
    const options = placeholderOptions('birthday', 'playful')
    expect(options[0]).toBe(placeholderFor('birthday', 'playful'))
  })

  it('never repeats a note in the rotation', () => {
    for (const { value } of OCCASIONS) {
      const options = placeholderOptions(value, DEFAULT_MOOD)
      expect(new Set(options).size).toBe(options.length)
    }
  })

  /* The prompt bans em dashes in generated prose; the placeholders are held to the same voice. */
  it('uses no em dashes anywhere in the copy', () => {
    for (const { value } of OCCASIONS) {
      for (const note of placeholderOptions(value, DEFAULT_MOOD)) {
        expect(note).not.toMatch(/[—–]/)
      }
    }
  })
})

describe('occasions and moods', () => {
  it('offers a default that is one of the listed options', () => {
    expect(OCCASIONS.map((o) => o.value)).toContain(DEFAULT_OCCASION)
    expect(MOODS.map((m) => m.value)).toContain(DEFAULT_MOOD)
  })

  it('has no duplicate wire values, which would make a pick ambiguous', () => {
    expect(new Set(OCCASIONS.map((o) => o.value)).size).toBe(OCCASIONS.length)
    expect(new Set(MOODS.map((m) => m.value)).size).toBe(MOODS.length)
  })

  it('labels a known occasion and passes an unknown one through', () => {
    expect(labelFor(DEFAULT_OCCASION)).toBeTruthy()
    expect(labelFor('halloween')).toBeTruthy()
  })
})
