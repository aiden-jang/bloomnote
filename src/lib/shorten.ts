// Tiny client for the /api/shorten endpoint. Returns the short URL on
// success; throws on any failure so the caller can decide whether to
// fall back to the long URL (current Composer behavior: silently use
// the long URL — never break the share).

export async function shortenUrl(url: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch('/api/shorten', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
    signal,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) detail = body.error
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  const data = await res.json()
  if (typeof data?.shortUrl !== 'string') throw new Error('No shortUrl in response.')
  return data.shortUrl
}
