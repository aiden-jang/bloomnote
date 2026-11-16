export interface Occasion {
  value: string
  label: string
}

// Labels are lowercase and casual; the wire `value` stays stable, so existing drafts and the
// backend's canonical-label map (api/src/designGarden.ts, KNOWN_OCCASIONS) keep working.
// Get-well and sympathy stay warm rather than jokey: a punchline reads wrong on a grief garden.
export const OCCASIONS: readonly Occasion[] = [
  { value: 'just-because', label: 'just because' },
  { value: 'birthday', label: 'birthday' },
  { value: 'thank-you', label: 'thank you' },
  { value: 'anniversary', label: 'anniversary' },
  { value: 'congrats', label: 'congrats' },
  { value: 'get-well', label: 'get well' },
  { value: 'sympathy', label: 'sympathy' },
] as const

export const DEFAULT_OCCASION: Occasion['value'] = 'just-because'

export function labelFor(value: string): string {
  return OCCASIONS.find((o) => o.value === value)?.label ?? 'just because'
}

export type OccasionTone = 'ordinary' | 'sensitive' | 'neutral'

/** Mood never makes a sympathy or get-well screen a place for an interface joke. */
export function occasionTone(occasion: string | null | undefined): OccasionTone {
  if (occasion === 'sympathy' || occasion === 'get-well') return 'sensitive'
  return OCCASIONS.some((item) => item.value === occasion) ? 'ordinary' : 'neutral'
}
