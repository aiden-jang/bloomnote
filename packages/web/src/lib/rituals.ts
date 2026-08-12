/*
 * A small invitation above the note field.
 *
 * Distinct from the placeholder, which shows an example note for the chosen occasion and mood. This is a
 * different job: not "here is what a birthday note sounds like" but "here is a way in". People open a
 * blank field with something to say and no idea how to start, and the hour of the day is a surprisingly
 * good hint about which way in will land.
 *
 * The part worth getting right is the hard days. A get-well or a sympathy garden is written by somebody
 * who is already struggling to find words, and the correct move there is to lower the bar rather than
 * offer a better prompt. So those rituals give permission instead of direction: they say a short note is
 * enough, because the thing stopping somebody is usually the belief that it is not.
 *
 * No streaks, no "you have not written today", nothing that turns an invitation into an obligation. Same
 * rule as everything else here; see quietMode.ts.
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

/**
 * Occasions where the writing is hard.
 *
 * Kept as a list rather than inferred from mood, because mood says how the note should sound and this is
 * about how the writer is doing. Somebody can pick a playful mood for a get-well note precisely because
 * the situation is grim, and reading that as "they are fine" would be exactly backwards.
 */
const HARD_OCCASIONS = new Set(['sympathy', 'get-well'])

const BY_TIME: Record<RitualTime, string> = {
  morning: 'what do you want them to know before the day gets loud?',
  afternoon: 'what came up today that made you think of them?',
  evening: 'what is worth saying now that the day is done?',
  // Not "you should be asleep". Somebody writing at 3am has a reason.
  night: 'late is a good time to be honest. what is on your mind?',
}

/**
 * Softer invitations for a hard note, and the permission that matters more than the prompt.
 *
 * Deliberately does not ask the writer to be eloquent, find meaning, or say the right thing. Every one of
 * those is a reason to close the tab.
 */
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
