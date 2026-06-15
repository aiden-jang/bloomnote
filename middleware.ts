// Edge middleware that rewrites `<meta og:image>` on /g/<id> responses
// so link-preview crawlers see the per-garden OG image from /api/og.
// Without this, every shared garden would show the generic index.html
// preview (crawlers don't run our React app — they only see the HTML).

export const config = {
  // Only run on /g/<...>. CSS, JS, /api/*, and the rest of the site
  // skip this middleware entirely. Saves an edge invocation on every
  // asset request.
  matcher: '/g/:id*',
}

const SHORT_ID_PATTERN = /^[A-HJ-NP-Za-km-z2-9]{6}$/

export default async function middleware(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url)
  const match = url.pathname.match(/^\/g\/(.+)$/)
  if (!match) return  // pass through

  const id = match[1]
  // Only personalize for legitimate short IDs. Garbage paths like
  // /g/<random-blob> fall through to the static HTML's generic OG.
  if (!SHORT_ID_PATTERN.test(id)) return

  // Skip if the request isn't an HTML document — bots scraping for
  // images, RSS readers, etc. We only care about preview-card
  // crawlers, which all send `Accept: text/html`.
  const accept = req.headers.get('accept') ?? ''
  if (!accept.includes('text/html')) return

  // Fetch the static index.html via a regular request to the same
  // origin. We can't `import` it because the bundler doesn't know
  // about static assets, and we can't read the filesystem in Edge.
  // The fetch is fast because the HTML is already at the edge.
  const indexResp = await fetch(new URL('/', url.origin), {
    // Don't loop back into this middleware — the matcher above only
    // catches /g/* anyway, but being explicit avoids surprises if
    // matchers change.
    headers: { 'x-middleware-bypass': '1' },
  })
  if (!indexResp.ok) return

  let html = await indexResp.text()

  // Build the absolute URL for the OG image endpoint. Crawlers don't
  // resolve relative URLs reliably; some require fully-qualified.
  const ogImageUrl = `${url.origin}/api/og?id=${encodeURIComponent(id)}`
  const pageUrl = `${url.origin}/g/${encodeURIComponent(id)}`

  // Strip any existing og:image / og:url / twitter:image tags so we
  // don't end up with duplicates that crawlers might pick at random.
  // (Twitter's scraper, in particular, picks the LAST occurrence.)
  html = html
    .replace(/<meta\s+property="og:image"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:url"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:image"[^>]*>/gi, '')

  // Inject our personalized tags right before </head>. Using
  // string-replace on </head> is fine because the static index.html
  // is a known shape — not user-generated content with ambiguous
  // markup.
  const injected = `
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta name="twitter:image" content="${ogImageUrl}" />
    <meta name="twitter:card" content="summary_large_image" />
    </head>`
  html = html.replace('</head>', injected)

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Short cache: crawlers re-fetch occasionally; we don't want
      // a stale OG tag pointing at an old image after we tweak the
      // generator. Per-garden image URLs are stable so this only
      // affects the meta-tag layer, not the image itself.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}
