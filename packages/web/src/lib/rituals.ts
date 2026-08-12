/*
 * A way in, not an example note (that is the placeholder's job). Hard occasions give permission rather
 * than direction: what stops somebody writing a sympathy note is believing a short one is not enough.
 */

export type RitualTime = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Ritual {
  /** The invitation itself, lowercase like the rest of the app. */
  invitation: string
  /** A second, quieter line. Only present where somebody probably needs the permission. */
  permission: string | null
}

export function ritualTime(now = new Date()): RitualTime {
  const hour = now.getHours()
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** A list, not inferred from mood: somebody picks a playful mood for a get-well note precisely because
 *  the situation is grim, and reading that as "they are fine" is backwards. */
const HARD_OCCASIONS = new Set(['sympathy', 'get-well'])

const BY_TIME: Record<RitualTime, string> = {
  morning: 'what do you want them to know before the day gets loud?',
  afternoon: 'what came up today that made you think of them?',
  evening: 'what is worth saying now that the day is done?',
  // Not "you should be asleep". Somebody writing at 3am has a reason.
  night: 'late is a good time to be honest. what is on your mind?',
}

/** Never asks the writer to be eloquent or say the right thing: each is a reason to close the tab. */
const HARD: Record<RitualTime, Ritual> = {
  morning: {
    invitation: 'you do not have to know what to say yet.',
    permission: 'a short one still arrives.',
  },
  afternoon: {
    invitation: 'you do not have to make this a nice note.',
    permission: 'saying you are thinking of them is the whole message.',
  },
  evening: {
    invitation: 'nothing you write here has to be tidy.',
    permission: 'one honest line is more than enough.',
  },
  night: {
    invitation: 'if you cannot sleep, you can just say that.',
    permission: 'they will not be grading it.',
  },
}

/**
 * The ritual for this moment.
 *
 * @param occasion the wire-format occasion key, or null before one is chosen.
 * @param now injected so the copy is testable rather than dependent on when the suite runs.
 */
export function ritual(occasion: string | null | undefined, now = new Date()): Ritual {
  const time = ritualTime(now)
  if (occasion && HARD_OCCASIONS.has(occasion)) return HARD[time]
  return { invitation: BY_TIME[time], permission: null }
}

/** Every line, so a test can hold the whole set to the same standard. */
export const ALL_RITUALS: Ritual[] = [
  ...(['morning', 'afternoon', 'evening', 'night'] as RitualTime[]).flatMap((time) => [
    { invitation: BY_TIME[time], permission: null },
    HARD[time],
  ]),
]
