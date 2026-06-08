// The occasion picker. Listed in roughly emotional-warmth order — the
// default ("Just because") is the most generic; the more specific ones
// follow.
//
// The `value` is the wire-format key sent to the backend and stored in
// the draft. The `label` is what the user sees. They're decoupled so a
// label refresh ("Get well" → "Get well soon") doesn't invalidate
// existing drafts.

export interface Occasion {
  value: string
  label: string
}

export const OCCASIONS: readonly Occasion[] = [
  { value: 'just-because', label: 'Just because' },
  { value: 'birthday',     label: 'Birthday' },
  { value: 'thank-you',    label: 'Thank you' },
  { value: 'anniversary',  label: 'Anniversary' },
  { value: 'congrats',     label: 'Congratulations' },
  { value: 'get-well',     label: 'Get well soon' },
  { value: 'sympathy',     label: 'Sympathy' },
] as const

export const DEFAULT_OCCASION: Occasion['value'] = 'just-because'

export const OCCASION_VALUES = new Set<string>(OCCASIONS.map(o => o.value))

export function labelFor(value: string): string {
  return OCCASIONS.find(o => o.value === value)?.label ?? 'Just because'
}
