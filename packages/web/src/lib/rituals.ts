import { occasionTone } from './occasions'

export type RitualTime = 'morning' | 'afternoon' | 'evening' | 'night'

export interface Ritual {
  invitation: string
  permission: string | null
}

export function ritualTime(now = new Date()): RitualTime {
  const hour = now.getHours()
  if (hour < 5) return 'night'
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

const BY_TIME: Record<RitualTime, string> = {
  morning: 'what would you like them to know today?',
  afternoon: 'what made you think of them?',
  evening: 'anything you’d like to leave with them?',
  night: 'what’s on your mind?',
}

const HARD: Record<RitualTime, Ritual> = {
  morning: {
    invitation: 'thinking of them is enough to start.',
    permission: 'one honest line is plenty.',
  },
  afternoon: {
    invitation: 'you can keep this simple.',
    permission: 'saying you’re thinking of them is enough.',
  },
  evening: {
    invitation: 'there’s no set way to write this.',
    permission: 'use your own words.',
  },
  night: {
    invitation: 'you can leave a short note.',
    permission: 'there’s no need for a big message.',
  },
}

export function ritual(occasion: string | null | undefined, now = new Date()): Ritual {
  const time = ritualTime(now)
  if (occasionTone(occasion) === 'sensitive') return HARD[time]
  return { invitation: BY_TIME[time], permission: null }
}

/** Every line, so a test can hold the whole set to the same standard. */
export const ALL_RITUALS: Ritual[] = [
  ...(['morning', 'afternoon', 'evening', 'night'] as RitualTime[]).flatMap((time) => [
    { invitation: BY_TIME[time], permission: null },
    HARD[time],
  ]),
]
