import type { GardenData } from '../garden'
import type { MineRecord } from './mine'

/** A coarse bucket for a failed generation. Deliberately not the raw message: model errors can
    carry pieces of the user's note. */
export function classifyError(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown'
  const m = err.message.toLowerCase()
  if (m.includes('abort')) return 'aborted'
  if (m.includes('rate')) return 'rate_limited'
  if (m.includes('timeout') || m.includes('timed out')) return 'timeout'
  if (m.includes('network') || m.includes('fetch')) return 'network'
  if (m.includes('validation') || m.includes('invalid')) return 'validation'
  return 'model'
}

export function buildMineRecord(id: string, data: GardenData): MineRecord {
  return {
    id,
    to: data.to ?? '',
    from: data.from ?? '',
    occasion: data.occasion,
    mood: data.mood,
    createdAt: data.createdAt ?? new Date().toISOString(),
    unlockAt: data.unlockAt,
    swatches: data.flowers.map((f) => f.petalColors[0]).slice(0, 5),
  }
}

export function charCountTierClass(len: number, styles: Record<string, string>): string {
  if (len === 0) return ''
  if (len < 40) return styles.charCountThin ?? ''
  if (len < 320) return styles.charCountGood ?? ''
  return styles.charCountNear ?? ''
}
