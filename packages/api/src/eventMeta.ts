/*
 * The only keys allowed out of an event and into the logs.
 *
 * The client swears it sends no note text and no names, and it is careful about it. But this
 * endpoint is public and unauthenticated: anything at all can POST to it, and whatever arrives
 * used to be stringified straight into Workers Logs. On an app that exists to carry someone's
 * private message, that promise has to be kept by the server, not by the caller.
 *
 * Values are capped in length and to primitives, so a permitted key cannot smuggle a payload.
 */
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
