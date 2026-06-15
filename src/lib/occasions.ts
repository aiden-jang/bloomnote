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

// Display labels are intentionally lowercase + texting-casual. The wire
// `value` stays stable so existing drafts and the backend's
// canonical-label map (api/design-garden.ts → KNOWN_OCCASIONS) keep
// working — the AI still receives the proper "Birthday" / "Sympathy"
// tone signal even though the user sees "hbd" / "here for u" in the
// dropdown. Get-well and sympathy deliberately stay warm rather than
// jokey: a punchline reads wrong on a grief or sickbed garden.
export const OCCASIONS: readonly Occasion[] = [
  { value: 'just-because', label: 'just bc' },
  { value: 'birthday',     label: 'hbd' },
  { value: 'thank-you',    label: 'ty' },
  { value: 'anniversary',  label: 'we made it' },
  { value: 'congrats',     label: 'big w' },
  { value: 'get-well',     label: 'rest up' },
  { value: 'sympathy',     label: 'here for u' },
] as const

export const DEFAULT_OCCASION: Occasion['value'] = 'just-because'

export const OCCASION_VALUES = new Set<string>(OCCASIONS.map(o => o.value))

export function labelFor(value: string): string {
  return OCCASIONS.find(o => o.value === value)?.label ?? 'just bc'
}
