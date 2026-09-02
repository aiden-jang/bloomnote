import { describe, expect, it } from 'vitest'
import { gardenImpact } from './gardenImpact'

describe('gardenImpact', () => {
  it('combines waters and feelings without counting quiet gardens as responses', () => {
    expect(
      gardenImpact(['a', 'b', 'c'], {
        a: { waters: 3, feelings: { love: 2, joy: 1 } },
        b: { waters: 1, feelings: { love: 1, comfort: 4 } },
        c: { waters: 0, feelings: {} },
      }),
    ).toEqual({
      totalWaters: 4,
      totalFeelings: 8,
      respondedGardens: 2,
      strongestFeeling: { feeling: 'comfort', count: 4 },
      mostWateredId: 'a',
    })
  })

  it('returns a quiet recap when nothing has come back yet', () => {
    expect(gardenImpact(['a'], {})).toEqual({
      totalWaters: 0,
      totalFeelings: 0,
      respondedGardens: 0,
      strongestFeeling: null,
      mostWateredId: null,
    })
  })
})

it('keeps the first garden when two are watered the same amount', () => {
  // Ties are the common case early on, when everything sits at one water. Whichever is picked,
  // it must not drift as later gardens are read, or "most watered" changes on every refresh.
  const impact = gardenImpact(['first', 'second'], {
    first: { waters: 2, feelings: {} },
    second: { waters: 2, feelings: {} },
  })
  expect(impact.mostWateredId).toBe('first')
})

it('treats a negative water count as zero rather than subtracting from the total', () => {
  // The count comes back from the API, so it is not this module's to trust.
  const impact = gardenImpact(['a', 'b'], {
    a: { waters: 5, feelings: {} },
    b: { waters: -100, feelings: {} },
  })
  expect(impact.totalWaters).toBe(5)
})
