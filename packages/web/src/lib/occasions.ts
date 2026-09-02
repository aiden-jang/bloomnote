export interface Occasion {
  value: string
  label: string
}

// Labels are lowercase and casual; the wire `value` stays stable, so existing drafts and the
// backend's canonical-label map (api/src/designGarden.ts, KNOWN_OCCASIONS) keep working.
// Get-well and sympathy stay warm rather than jokey: a punchline reads wrong on a grief garden.
export const OCCASIONS: readonly Occasion[] = [
  { value: 'just-because', label: 'just bc' },
  { value: 'birthday', label: 'hbd' },
  { value: 'thank-you', label: 'ty' },
  { value: 'anniversary', label: 'we made it' },
  { value: 'congrats', label: 'big w' },
  { value: 'get-well', label: 'rest up' },
  { value: 'sympathy', label: 'here for u' },
] as const

export const DEFAULT_OCCASION: Occasion['value'] = 'just-because'

export function labelFor(value: string): string {
  return OCCASIONS.find((o) => o.value === value)?.label ?? 'just bc'
}
