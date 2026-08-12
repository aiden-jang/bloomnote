import { describe, expect, it } from 'vitest'
import type { FlowerJournalEntry } from './flowerJournal'
import { constellationLine, constellations, mentionsIn } from './constellations'

/*
 * Extraction from free text is mostly a war against false positives.
 *
 * Every sentence starts with a capital, so a naive "capitalised word means name" reading hands back
 * Today, Then and Because as people the person keeps writing about. That is worse than finding nothing:
 * a feature whose whole promise is "here is a pattern in your life" loses all credibility the first time
 * it claims you have a recurring relationship with Monday.
 */

let n = 0
function entry(memory: string, over: Partial<FlowerJournalEntry> = {}): FlowerJournalEntry {
  n += 1
  return {
    id: `e${n}`,
    gardenId: `g${n}`,
    flowerIndex: 0,
    flowerName: 'Hydrangea',
    meaning: 'for the rain',
    colors: ['#e11d48'],
    memory,
    savedAt: `2026-08-${String(n).padStart(2, '0')}T10:00:00.000Z`,
    ...over,
  }
}

const labels = (memory: string): string[] => mentionsIn(entry(memory)).map((m) => `${m.kind}:${m.label}`)

describe('what counts as a name', () => {
  it('finds a name mid-sentence', () => {
    expect(labels('I saw Nadia at the market.')).toContain('person:Nadia')
  })

  it('ignores the capital that starts a sentence', () => {
    // The single biggest source of nonsense. "Today", "Then", "Because" are not people.
    const found = labels('Today was hard. Then it rained. Because of course.')
    expect(found.filter((f) => f.startsWith('person:'))).toEqual([])
  })

  it('ignores weekdays and months even mid-sentence', () => {
    expect(labels('we went on Tuesday and again in August.')).toEqual([])
  })

  it('ignores shouting', () => {
    // All-caps is emphasis, not a name, and "SO tired" should not invent a person called SO.
    expect(labels('it was SO tired making, TRULY')).not.toContain('person:So')
  })

  it('treats a possessive as the same person', () => {
    expect(labels("we used Nadia's car.")).toContain('person:Nadia')
    expect(labels('we saw Nadia, briefly.')).toContain('person:Nadia')
  })

  it('trusts the sender field over any guessing', () => {
    // The one name we actually know rather than infer.
    const found = mentionsIn(entry('no names in here at all.', { from: 'Sofia' }))
    expect(found).toEqual([{ key: 'sofia', label: 'Sofia', kind: 'person' }])
  })
})

describe('places', () => {
  it('reads a capitalised word after a preposition as a place', () => {
    expect(labels('we ate at Roberta and it was good.')).toContain('place:Roberta')
  })

  it('still calls it a person without the preposition', () => {
    expect(labels('I called Roberta twice.')).toContain('person:Roberta')
  })
})

describe('feelings', () => {
  it('finds a plain feeling word', () => {
    expect(labels('I was so tired but grateful.')).toEqual(
      expect.arrayContaining(['feeling:tired', 'feeling:grateful']),
    )
  })

  it('folds inflections onto one thread', () => {
    // Split across forms, neither reaches the two-entry floor and the pattern never appears.
    expect(labels('the exhaustion was total.')).toContain('feeling:exhausted')
    expect(labels('it was exhausting.')).toContain('feeling:exhausted')
    expect(labels('I am exhausted.')).toContain('feeling:exhausted')
  })

  it('does not mistake a capitalised feeling for a name', () => {
    expect(labels('honestly? Tired.')).toContain('feeling:tired')
    expect(labels('honestly? Tired.')).not.toContain('person:Tired')
  })

  it('keeps the hard feelings, not only the nice ones', () => {
    // A journal that can only notice happiness is useless on the days it matters most.
    for (const word of ['lonely', 'grieving', 'ashamed', 'overwhelmed']) {
      expect(labels(`I felt ${word} about it.`)).toContain(`feeling:${word}`)
    }
  })
})

describe('one entry counts once', () => {
  it('does not let a single long entry invent a pattern', () => {
    // Saying a name four times in one sitting is one entry about that person.
    const found = mentionsIn(entry('Nadia. Then Nadia again, and Nadia, and Nadia.'))
    expect(found.filter((m) => m.key === 'nadia')).toHaveLength(1)
  })
})

describe('recurrence', () => {
  it('needs two entries before it is a thread', () => {
    const once = constellations([entry('I saw Nadia.')])
    expect(once).toEqual([])

    const twice = constellations([entry('I saw Nadia.'), entry('Nadia called.')])
    expect(twice.map((c) => c.label)).toEqual(['Nadia'])
    expect(twice[0]?.entryCount).toBe(2)
  })

  it('links back to the entries it came from', () => {
    const a = entry('lunch with Nadia.')
    const b = entry('Nadia again.')
    const [found] = constellations([a, b])
    // Newest first, so tapping through starts at the most recent.
    expect(found?.entryIds).toEqual([b.id, a.id])
  })

  it('orders by what is live, not by what is biggest', () => {
    const old = [entry('Nadia.'), entry('Nadia.'), entry('Nadia.'), entry('Nadia.')]
    const recent = [
      entry('Theo.', { savedAt: '2026-12-01T10:00:00.000Z' }),
      entry('Theo.', { savedAt: '2026-12-02T10:00:00.000Z' }),
    ]
    const found = constellations([...old, ...recent])
    // A name from months ago outranking this week's would make it read as an archive.
    expect(found[0]?.label).toBe('Theo')
  })

  it('is empty on an empty journal', () => {
    expect(constellations([])).toEqual([])
  })

  it('survives entries with nothing in them', () => {
    expect(constellations([entry(''), entry('   '), entry('.')])).toEqual([])
  })
})

describe('the sentence it produces', () => {
  it('counts entries, not mentions', () => {
    const [c] = constellations([entry('Nadia.'), entry('Nadia.')])
    expect(constellationLine(c!)).toBe('Nadia is in 2 of your entries.')
  })

  it('reads naturally for a feeling', () => {
    const [c] = constellations([entry('I was tired.'), entry('tired again.')])
    expect(constellationLine(c!)).toBe('you have written about feeling tired twice.')
  })

  /*
   * The line that keeps this compatible with quiet mode.
   *
   * Counting entries is a fact about subjects. Counting days, weeks or streaks would turn a journal into
   * something that can be broken, and the whole app is built on the opposite promise.
   */
  it('never mentions days, weeks or streaks', () => {
    const many = Array.from({ length: 6 }, () => entry('tired again.'))
    for (const c of constellations(many)) {
      expect(constellationLine(c)).not.toMatch(/day|week|streak|row|consecutive/i)
    }
  })
})
