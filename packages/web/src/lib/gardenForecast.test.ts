import { describe, expect, test } from 'vitest'
import { gardenForecast } from './gardenForecast'

describe('gardenForecast', () => {
  test('lets an explicit mood outrank the occasion fallback', () => {
    const forecast = gardenForecast('you did it!', 'wistful', 'congrats')
    expect(forecast.tone).toBe('quietly nostalgic')
    expect(forecast.light).toBe('bright afternoon light')
  })

  test('uses the occasion when no mood direction was chosen', () => {
    expect(gardenForecast('happy birthday', 'none', 'birthday').tone).toBe('big & buoyant')
    expect(gardenForecast('thinking of you', 'none', 'sympathy').tone).toBe('grounded & reassuring')
  })

  test('rewards specific notes without sending or retaining their text', () => {
    const thin = gardenForecast('love you', 'tender', 'just-because')
    const rich = gardenForecast(
      'remember that time in Lisbon? you still laugh before the punchline every time.',
      'tender',
      'just-because',
    )
    expect(thin.detailLevel).toBe(1)
    expect(rich.detailLevel).toBe(3)
    expect(rich).not.toHaveProperty('message')
  })

  test('always returns a complete safe fallback for old draft values', () => {
    const forecast = gardenForecast('a note with enough words to grow from', 'retired-mood', 'retired-occasion')
    expect(forecast.colors).toHaveLength(3)
    expect(forecast.tone).toBe('warm & unforced')
    expect(forecast.light).toBe('easy sunlit warmth')
  })
})
