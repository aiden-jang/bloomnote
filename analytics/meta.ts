const choices: Record<string, readonly string[]> = {
  mode: ['fresh', 'remix'],
  occasion: ['just-because', 'birthday', 'thank-you', 'anniversary', 'congrats', 'get-well', 'sympathy'],
  mood: ['none', 'tender', 'playful', 'wistful', 'celebratory', 'steady'],
  errorType: [
    'unknown',
    'aborted',
    'rate_limited',
    'timeout',
    'network',
    'validation',
    'model',
    'validation_failed',
    'upstream_busy',
  ],
  surface: ['composer', 'recipient', 'mine'],
  format: ['square', 'story', 'duet'],
  method: ['native', 'copy'],
}
const numbers: Record<string, number> = { flowerCount: 100, attempt: 10000, durationMs: 3600000 }
const flags = new Set(['hasFromName', 'hasThread', 'isRemix'])
/** Closed values as well as keys: private text cannot hide inside a permitted metadata field. */
export function safeMeta(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [key, value] of Object.entries(raw)) {
    if (Object.hasOwn(choices, key) && typeof value === 'string' && choices[key]!.includes(value))
      out[key] = value
    else if (
      Object.hasOwn(numbers, key) &&
      typeof value === 'number' &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= numbers[key]!
    )
      out[key] = value
    else if (flags.has(key) && typeof value === 'boolean') out[key] = value
  }
  return out
}
