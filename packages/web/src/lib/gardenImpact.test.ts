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
