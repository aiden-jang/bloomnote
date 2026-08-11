import type { Feeling, GardenResponse } from './water'

export interface GardenImpact {
  totalWaters: number
  totalFeelings: number
  respondedGardens: number
  strongestFeeling: { feeling: Feeling; count: number } | null
  mostWateredId: string | null
}

/** Roll anonymous recipient gestures into a small sender-facing recap. */
export function gardenImpact(
  gardenIds: string[],
  responses: Record<string, GardenResponse>,
): GardenImpact {
  const feelingTotals: Partial<Record<Feeling, number>> = {}
  let totalWaters = 0
  let respondedGardens = 0
  let mostWateredId: string | null = null
  let mostWaters = 0

  for (const id of gardenIds) {
    const response = responses[id]
    if (!response) continue
    const waters = Math.max(0, response.waters)
    const feelings = Object.values(response.feelings).reduce((sum, count) => sum + (count ?? 0), 0)
    totalWaters += waters
    if (waters + feelings > 0) respondedGardens += 1
    if (waters > mostWaters) {
      mostWaters = waters
      mostWateredId = id
    }
    for (const [feeling, count] of Object.entries(response.feelings) as [Feeling, number][]) {
      feelingTotals[feeling] = (feelingTotals[feeling] ?? 0) + Math.max(0, count)
    }
  }

  const rankedFeelings = (Object.entries(feelingTotals) as [Feeling, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
  const totalFeelings = rankedFeelings.reduce((sum, [, count]) => sum + count, 0)

  return {
    totalWaters,
    totalFeelings,
    respondedGardens,
    strongestFeeling: rankedFeelings[0]
      ? { feeling: rankedFeelings[0][0], count: rankedFeelings[0][1] }
      : null,
    mostWateredId,
  }
}
