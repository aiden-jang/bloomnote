import { describe, expect, it } from 'vitest'
import { ALL_RITUALS, ritual, ritualTime } from './rituals'

/*
 * The hard-day rituals are the ones with real stakes.
 *
 * Somebody writing a sympathy or get-well note has already decided the words matter and is stuck on
 * finding them. A prompt that asks them to be thoughtful, meaningful or eloquent is one more reason to
 * close the tab, so most of what follows asserts the absence of that vocabulary rather than the presence
 * of anything.
 */

const at = (hour: number) => new Date(2026, 7, 12, hour)

describe('the time of day', () => {
  it('splits the day where it actually changes', () => {
    expect(ritualTime(at(8))).toBe('morning')
    expect(ritualTime(at(14))).toBe('afternoon')
    expect(ritualTime(at(20))).toBe('evening')
    expect(ritualTime(at(3))).toBe('night')
  })

  it('asks something different at each of them', () => {
    const seen = new Set([8, 14, 20, 3].map((h) => ritual('just-because', at(h)).invitation))
    expect(seen.size).toBe(4)
  })
})

describe('an ordinary note', () => {
  it('offers a way in and no permission slip', () => {
    const r = ritual('just-because', at(9))
    expect(r.invitation).toMatch(/\?$/)
    // Nothing to give permission for: writing a cheerful note is not the thing people freeze on.
    expect(r.permission).toBeNull()
  })

  it('works before an occasion is chosen', () => {
    for (const value of [null, undefined, '']) {
      expect(ritual(value, at(9)).invitation.length).toBeGreaterThan(10)
    }
  })
})

describe('a hard note', () => {
  it('lowers the bar instead of raising it', () => {
    for (const occasion of ['sympathy', 'get-well']) {
      const r = ritual(occasion, at(14))
      expect(r.permission).not.toBeNull()
      expect(r.invitation).toMatch(/do not have to/)
    }
  })

  /*
   * The assertion that matters most.
   *
   * "Say something meaningful", "find the right words", "make it special" are all reasonable-sounding
   * prompts and all of them add weight to the exact moment somebody is least able to carry it.
   *
   * Deliberately blunt: it cannot see negation, so "you do not have to find the right words" trips it too.
   * That is the right trade. Copy that avoids the vocabulary outright is just as warm, and a guard that
   * tried to parse negation would be the kind of clever check that quietly stops working.
   */
  it('never asks for eloquence', () => {
    const heavy = [
      /meaningful/i,
      /profound/i,
      /perfect/i,
      /right words/i,
      /special/i,
      /heartfelt/i,
      /make it count/i,
      /do it justice/i,
      /worthy/i,
      /eloquent/i,
      /beautiful/i,
    ]
    for (const occasion of ['sympathy', 'get-well']) {
      for (const hour of [3, 9, 14, 20]) {
        const r = ritual(occasion, at(hour))
        const both = `${r.invitation} ${r.permission ?? ''}`
        for (const pattern of heavy) {
          expect(both, `${occasion} at ${hour}:00 asks too much`).not.toMatch(pattern)
        }
      }
    }
  })

  it('does not tell somebody awake at 3am to go to bed', () => {
    // They have a reason, and it is not ours to correct.
    const late = ritual('sympathy', at(3))
    expect(`${late.invitation} ${late.permission}`).not.toMatch(
      /go to (bed|sleep)|should be asleep|get some rest/i,
    )
  })

  it('reads gently even for a cheerful mood on a grim occasion', () => {
    // Mood says how the note should sound; the occasion says how the writer is doing. Only the second
    // decides this, or picking a light tone for a hard situation would read as "they are fine".
    expect(ritual('get-well', at(14)).permission).not.toBeNull()
  })
})

describe('every line', () => {
  it('is lowercase, like the rest of the app', () => {
    for (const r of ALL_RITUALS) {
      for (const line of [r.invitation, r.permission].filter(Boolean) as string[]) {
        expect(line[0]).toBe(line[0]!.toLowerCase())
      }
    }
  })

  it('never nags about consistency', () => {
    // An invitation that mentions a streak is an obligation. See quietMode.ts for the same rule.
    for (const r of ALL_RITUALS) {
      const both = `${r.invitation} ${r.permission ?? ''}`
      expect(both).not.toMatch(/streak|every day|daily|keep it up|do not break|missed|behind|again today/i)
    }
  })

  it('has no em dashes', () => {
    for (const r of ALL_RITUALS) {
      expect(`${r.invitation} ${r.permission ?? ''}`).not.toContain('—')
    }
  })
})
