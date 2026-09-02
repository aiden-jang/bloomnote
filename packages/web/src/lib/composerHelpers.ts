import type { GardenData } from '../garden'
import type { MineRecord } from './mine'

/**
 * Pure helpers lifted out of the composer.
 *
 * The composer's own job — sequencing a generation, a save, a share URL and four kinds of
 * status — genuinely belongs in the component. These do not: each is a decision that can be
 * stated as an input and an output, and each was previously impossible to test without
 * rendering a form.
 */

/**
 * A coarse bucket for a failed generation.
 *
 * Deliberately not the raw message. Model errors can quote parts of the note or the prompt back
 * at you, and this string is sent to analytics — so it must never be able to carry the text
 * someone was writing.
 */
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

/** The on-device archive entry for a garden that was just sent. */
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

/**
 * Which style the character count wears.
 *
 * Longer notes make better gardens, and this says so without copy: the count grows more
 * confident as the note does, then turns amber near the limit.
 */
export function charCountTierClass(len: number, styles: Record<string, string>): string {
  if (len === 0) return ''
  if (len < 40) return styles.charCountThin ?? ''
  if (len < 320) return styles.charCountGood ?? ''
  return styles.charCountNear ?? ''
}
