// Font loader for @vercel/og image rendering.
//
// satori (the engine behind ImageResponse) needs raw font bytes — it
// can't reach for fonts the way a browser can. We fetch Fraunces from
// Google Fonts at runtime and cache the bytes in module scope so the
// per-isolate cost is "fetch once, reuse forever."
//
// Why fetch instead of bundling: bundling fonts as static assets via
// `new URL(..., import.meta.url)` works in production but is fragile
// with our custom Vite dev adapter (file paths resolve differently in
// SSR-mode imports vs prod). Fetching from a stable CDN URL works the
// same in both environments and adds about 200ms once per cold isolate.
//
// Caching strategy:
//   - `cached` holds the resolved bytes after first success.
//   - `inFlight` holds the in-progress promise. Two concurrent calls
//     during a cold start share the same fetch (no thundering herd).
//   - Both are module-scoped, so they persist across invocations
//     within the same Edge isolate. Cold starts re-fetch (one-time
//     cost, typically ~200ms total).

interface FrauncesFonts {
  regular: ArrayBuffer
  italic: ArrayBuffer
}

let cached: FrauncesFonts | null = null
let inFlight: Promise<FrauncesFonts> | null = null

/**
 * Parse Google Fonts CSS to extract the direct .woff2 (or .ttf) URL,
 * then fetch the binary data. Google Fonts CSS looks like:
 *
 *   @font-face {
 *     font-family: 'Fraunces';
 *     font-style: normal;
 *     src: url(https://fonts.gstatic.com/.../font.woff2) format('woff2');
 *   }
 *
 * The regex grabs the URL between `src: url(` and `)`. If the format
 * ever changes we'll need to update this — known fragile dependency.
 */
async function loadGoogleFont(cssUrl: string): Promise<ArrayBuffer> {
  // Google Fonts negotiates font format via User-Agent. Modern Chrome
  // UAs get woff2 (compact) — but @vercel/og's font parser only
  // supports TTF (it throws "Unsupported OpenType signature wOF2" on
  // anything else). So we spoof an old Safari UA that predates woff2
  // support; Google sees that and falls back to TTF for us.
  const cssResp = await fetch(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_5_8; ko-kr) AppleWebKit/531.21.10 (KHTML, like Gecko) Version/4.0.4 Safari/531.21.10',
    },
  })
  if (!cssResp.ok) throw new Error(`Google Fonts CSS fetch failed: ${cssResp.status}`)
  const css = await cssResp.text()

  const match = css.match(/src:\s*url\(([^)]+)\)\s*format/)
  if (!match) throw new Error('Could not parse font URL from Google Fonts CSS')

  const fontResp = await fetch(match[1])
  if (!fontResp.ok) throw new Error(`Font binary fetch failed: ${fontResp.status}`)
  return await fontResp.arrayBuffer()
}

/**
 * Fetch (or return cached) Fraunces regular + italic.
 *
 * Picks a single weight (400) for each style because satori can't
 * interpolate variable-font axes at render time — each "instance"
 * of a font is one registration with a fixed weight/style. 400 is
 * the weight we use throughout the app, so it's the obvious pick.
 */
export async function getFraunces(): Promise<FrauncesFonts> {
  if (cached) return cached
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const [regular, italic] = await Promise.all([
        loadGoogleFont(
          'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&display=swap',
        ),
        loadGoogleFont(
          'https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@1,9..144,400&display=swap',
        ),
      ])
      cached = { regular, italic }
      return cached
    } finally {
      // Clear the in-flight slot regardless of outcome. On failure,
      // the next call retries from scratch instead of returning a
      // rejected promise forever.
      inFlight = null
    }
  })()

  return inFlight
}
