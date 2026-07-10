// Formats a stored ISO 8601 timestamp into a human "Month D, YYYY" string.
// Returns null for falsy or malformed input — callers conditionally render.
//
// We use Intl rather than hand-rolled month names so the format adapts
// to the user's locale; the en-US fallback handles the common case
// (e.g. "March 17, 2026").

export function formatGardenDate(iso: string | undefined): string | null {
  if (!iso) return null
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return null
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ts))
}
