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

// Display labels are intentionally lowercase + conversational. The wire
// `value` stays stable so existing drafts and the backend's
// canonical-label map (api/design-garden.ts → KNOWN_OCCASIONS) keep
// working — the AI still receives the proper "Birthday" / "Sympathy"
// tone signal even though the user sees "happy bday" / "thinking of
// you" in the dropdown.
export const OCCASIONS: readonly Occasion[] = [
  { value: 'just-because', label: 'no reason' },
  { value: 'birthday',     label: 'happy bday' },
  { value: 'thank-you',    label: 'thanks' },
  { value: 'anniversary',  label: 'still here' },
  { value: 'congrats',     label: 'you did it' },
  { value: 'get-well',     label: 'feel better' },
  { value: 'sympathy',     label: 'thinking of you' },
] as const

export const DEFAULT_OCCASION: Occasion['value'] = 'just-because'

export const OCCASION_VALUES = new Set<string>(OCCASIONS.map(o => o.value))

export function labelFor(value: string): string {
  return OCCASIONS.find(o => o.value === value)?.label ?? 'Just because'
}
