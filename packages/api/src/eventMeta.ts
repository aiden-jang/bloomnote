/* The only keys allowed out of an event and into the logs. An allowlist, not a denylist: the
   client is not trusted to keep the note text out of a meta field. */
export const META_KEYS = new Set([
  'mode',
  'errorType',
  'surface',
  'format',
  'method',
  'mood',
  'flowerCount',
  'hasFromName',
  'hasThread',
  'isRemix',
  'attempt',
  'durationMs',
])

const MAX_META_VALUE = 64

export function safeMeta(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [key, value] of Object.entries(raw)) {
    if (!META_KEYS.has(key)) continue
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
    else if (typeof value === 'boolean') out[key] = value
    else if (typeof value === 'string') out[key] = value.slice(0, MAX_META_VALUE)
  }
  return out
}
