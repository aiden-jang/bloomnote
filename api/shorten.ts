// Tiny URL shortener — proxies to TinyURL's free API.
//
// Why a backend endpoint and not a direct browser fetch:
//
//   1. CORS. TinyURL's response headers don't always include
//      Access-Control-Allow-Origin, so browser-side fetches can fail
//      depending on origin. Server-side has no CORS problem.
//
//   2. Provider switching. If TinyURL ever rate-limits us or goes
//      down, we can swap to is.gd, Bitly with a paid key, or a
//      self-hosted KV-backed shortener — the frontend doesn't care.
//
//   3. Hides any API keys we'd add later (e.g. for Bitly Pro).
//
// The endpoint is intentionally simple: { url } in, { shortUrl } out.
// If TinyURL fails, we return a 502 with the error message and the
// frontend falls back to displaying the original long URL — never a
// broken share.

export const config = { runtime: 'edge' }

interface ShortenRequest {
  url: string
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Invalid JSON.', 400)
  }

  const url = typeof (body as ShortenRequest | undefined)?.url === 'string'
    ? (body as ShortenRequest).url
    : ''

  if (!url || !/^https?:\/\//.test(url)) {
    return jsonError('Missing or malformed url.', 400)
  }

  try {
    // TinyURL's documented endpoint. Returns the short URL as plain text
    // (e.g. "https://tinyurl.com/abc123"), or an error string starting
    // with "Error:" on failure.
    const tinyResp = await fetch(
      `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`,
      { method: 'GET' },
    )

    if (!tinyResp.ok) {
      return jsonError(`Shortener returned HTTP ${tinyResp.status}`, 502)
    }

    const shortUrl = (await tinyResp.text()).trim()
    if (!shortUrl.startsWith('http')) {
      return jsonError(`Shortener returned malformed response: ${shortUrl.slice(0, 80)}`, 502)
    }

    return new Response(JSON.stringify({ shortUrl }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown shortener error.'
    return jsonError(message, 502)
  }
}
