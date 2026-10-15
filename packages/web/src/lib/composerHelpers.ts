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

/** Named so the copy under the disabled button and the rule that disables it cannot drift. */
export const MIN_MESSAGE_CHARS = 4

/** The 30-second grace has to match saved-garden validation. Without it, picking a time and
    then sitting on the page for a few seconds drops the schedule silently. */
export function scheduleErrorFor(
  scheduleOpen: boolean,
  unlockLocal: string,
  now = Date.now(),
): string | null {
  if (!scheduleOpen) return null
  // Empty is "not yet decided", not an error. Without this the picker complains the moment it opens.
  if (!unlockLocal) return null
  const at = new Date(unlockLocal).getTime()
  if (!Number.isFinite(at)) return 'that time looks malformed.'
  if (at <= now + 30_000) return 'that time has already passed. pick something in the future.'
  return null
}

/** Ordered by what to fix first. Once anything is typed the copy says what is missing, rather than
    telling somebody who is already writing to write a note. */
export function disabledReasonFor(input: {
  recipient: string
  message: string
  scheduleOpen: boolean
  unlockLocal: string
  scheduleError: string | null
}): string | null {
  const noRecipient = input.recipient.trim().length < 1
  const written = input.message.trim().length
  const noMessage = written < MIN_MESSAGE_CHARS
  const startedWriting = written > 0
  if (noRecipient && noMessage && !startedWriting) return 'add who it\u2019s for and a message to get started'
  if (noRecipient && noMessage) return 'add who it\u2019s for, and a few more words'
  if (noRecipient) return 'add who it\u2019s for in the \u201Cto\u201D field'
  if (noMessage) return startedWriting ? 'a few more words and it\u2019s ready' : 'write them a note first'
  if (input.scheduleError) return 'fix the scheduled time above'
  if (input.scheduleOpen && input.unlockLocal === '') {
    return 'pick a date & time above to schedule, or hit cancel to send now'
  }
  return null
}
