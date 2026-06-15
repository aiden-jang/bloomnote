// Edge middleware that personalizes the shared-link previews for
// /g/<id> requests. Without this, every shared garden falls back to
// the generic homepage `<title>` and `<meta>` tags — crawlers don't
// run our React app, so SPA-injected metadata never reaches them.
//
// Two layers of personalization:
//   1. <title> + og:title — "<sender> sent <recipient> a garden"
//   2. og:image — points at /api/og?id=<id> (the per-garden PNG)

import { Redis } from '@upstash/redis'

export const config = {
  // Only run on /g/<...>. Static assets and /api/* skip this entirely.
  matcher: '/g/:id*',
}

const SHORT_ID_PATTERN = /^[A-HJ-NP-Za-km-z2-9]{6}$/

// Lazy Redis client at module scope. We can't import the shared
// `api/_lib/redis.ts` helper here because the middleware bundle is
// separate from the api bundle. Duplicating the 5-line setup is
// cheaper than wrestling with cross-bundle imports.
let cachedRedis: Redis | null = null
function getRedis(): Redis | null {
  if (cachedRedis) return cachedRedis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  cachedRedis = new Redis({ url, token })
  return cachedRedis
}

// Subset of the garden shape we actually read here. Avoids importing
// the full GardenData type across the bundle boundary.
interface GardenPreview {
  from?: string
  to?: string
}

export default async function middleware(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url)
  const match = url.pathname.match(/^\/g\/(.+)$/)
  if (!match) return

  const id = match[1]
  if (!SHORT_ID_PATTERN.test(id)) return

  // Only intercept HTML document requests. Image scrapers, RSS
  // readers, etc. — let them fall through to the static asset.
  const accept = req.headers.get('accept') ?? ''
  if (!accept.includes('text/html')) return

  // Look up the garden so the preview can include the sender +
  // recipient names. If Redis is missing or the garden doesn't exist,
  // we still fall through to og:image personalization with a generic
  // title — better than nothing.
  let garden: GardenPreview | null = null
  const redis = getRedis()
  if (redis) {
    try {
      garden = (await redis.get(`g:${id}`)) as GardenPreview | null
    } catch {
      // Redis hiccup — soldier on with generic copy.
    }
  }

  const titleText = buildTitle(garden)
  const descriptionText = buildDescription(garden)

  // Fetch the static index.html so we can do string-level rewrites.
  // We can't import it directly (bundler doesn't know about static
  // assets) and can't read the filesystem in Edge.
  const indexResp = await fetch(new URL('/', url.origin), {
    headers: { 'x-middleware-bypass': '1' },
  })
  if (!indexResp.ok) return
  let html = await indexResp.text()

  const ogImageUrl = `${url.origin}/api/og?id=${encodeURIComponent(id)}`
  const pageUrl = `${url.origin}/g/${encodeURIComponent(id)}`

  // Swap the <title> first — drives the browser tab text when a user
  // (not a crawler) opens the link.
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(titleText)}</title>`)

  // Strip any existing meta tags we're about to replace so we don't
  // end up with duplicates. Twitter's scraper, in particular, picks
  // the LAST occurrence when multiples exist.
  html = html
    .replace(/<meta\s+property="og:image"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:url"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:title"[^>]*>/gi, '')
    .replace(/<meta\s+property="og:description"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:image"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:title"[^>]*>/gi, '')
    .replace(/<meta\s+name="twitter:description"[^>]*>/gi, '')
    .replace(/<meta\s+name="description"[^>]*>/gi, '')

  const escTitle = escapeHtml(titleText)
  const escDesc = escapeHtml(descriptionText)
  const injected = `
    <meta name="description" content="${escDesc}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:title" content="${escTitle}" />
    <meta property="og:description" content="${escDesc}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${ogImageUrl}" />
    <meta name="twitter:title" content="${escTitle}" />
    <meta name="twitter:description" content="${escDesc}" />
    </head>`
  html = html.replace('</head>', injected)

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Crawlers re-fetch occasionally; short cache keeps the meta
      // layer fresh if we tweak copy. The per-garden image is cached
      // forever via its own Cache-Control.
      'cache-control': 'public, max-age=300, s-maxage=300',
    },
  })
}

/** "Maya sent Sarah a garden" / "Maya sent you a garden" / fallback. */
function buildTitle(g: GardenPreview | null): string {
  const from = g?.from?.trim()
  const to = g?.to?.trim()
  if (from && to) return `${from} sent ${to} a garden`
  if (from) return `${from} sent you a garden`
  if (to) return `a garden for ${to}`
  return 'a garden, for you'
}

/** Short tease for the preview snippet. Doesn't spoil the bouquet. */
function buildDescription(g: GardenPreview | null): string {
  const from = g?.from?.trim()
  if (from) return `open the link to see what ${from} grew.`
  return 'open the link to watch it bloom.'
}

/** Minimal HTML-attribute escaping. Sender names come from user
 *  input, so they can contain quotes / angle brackets / ampersands
 *  that would break the meta tag if interpolated raw. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
