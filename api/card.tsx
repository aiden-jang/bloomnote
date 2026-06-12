// Downloadable card image — a 1080×1080 PNG of a specific garden,
// designed to live well in iMessage, Instagram, screenshots, or as a
// printed square card.
//
// Separate from /api/og because the constraints are different:
//
//   /api/og   → 1200×630, for link-preview cards. Wide aspect. No
//                 message text (the preview is a tease, not the
//                 payload). Heavy header, generous breathing room.
//
//   /api/card → 1080×1080, for downloaded sharing. Square. Includes
//                 the sender's message + signature + the flowers + a
//                 quiet wordmark. This is "the thing you screenshot
//                 and post," so it has to stand alone visually.
//
// Why a server endpoint instead of html2canvas on the client:
//   1. Identical pixel output across browsers (no mobile Safari
//      quirks rendering CSS gradients differently from desktop).
//   2. No font-loading race — @vercel/og embeds the rasterized
//      glyphs from the request, so the PNG never has fallback fonts.
//   3. Doesn't ship 30+ KB of html2canvas to the client bundle.
//   4. Same infrastructure as /api/og.tsx, so the cost is marginal.

import { ImageResponse } from '@vercel/og'
import { Redis } from '@upstash/redis'
import type { GardenData, FlowerSpec } from '../src/garden'
import { getFraunces } from './_lib/fonts'

export const config = { runtime: 'edge' }

let _redis: Redis | null = null
function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  _redis = new Redis({ url, token })
  return _redis
}

// 1080×1080 is the de-facto standard for "square share image" —
// Instagram feed (post-2017), iMessage chat bubbles, Discord embeds,
// printed cards. Larger than necessary for display but gives clean
// downsampling everywhere it lands.
const CARD_SIZE = 1080

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id || !/^[A-Za-z0-9]{4,12}$/.test(id)) {
    return new Response('Missing or malformed id.', { status: 400 })
  }

  const redis = getRedis()
  if (!redis) {
    return new Response('Short URLs disabled.', { status: 503 })
  }

  const raw = await redis.get(`g:${id}`)
  if (!raw) {
    return new Response('Garden not found.', { status: 404 })
  }
  const garden = raw as GardenData

  // `download=1` query param forces the browser to download rather
  // than display inline. Without it, the URL is previewable (handy for
  // debugging and for "view the image" links). The "save as image"
  // button on the frontend always passes this flag.
  const forceDownload = url.searchParams.get('download') === '1'

  // Filename: blossom-from-<sender>.png when we know the sender,
  // blossom-garden.png otherwise. URL-encoded so non-ASCII sender
  // names ("María") survive the Content-Disposition header.
  const safeSender = (garden.from || '').replace(/[^a-z0-9-]/gi, '-').slice(0, 40)
  const filename = safeSender ? `blossom-from-${safeSender}.png` : 'blossom-garden.png'

  return renderCard(garden, { forceDownload, filename })
}

async function renderCard(g: GardenData, opts: { forceDownload: boolean; filename: string }): Promise<Response> {
  const fonts = await getFraunces()
  const flowers = (g.flowers ?? []).slice(0, 5)
  const senderLine = g.from
    ? `${g.from} grew ${g.to || 'you'} a garden`
    : `someone grew ${g.to || 'you'} a garden`

  // The message text is the most variable element — could be 4 chars
  // or 400. We hard-cap at ~280 chars in the rendered output (truncate
  // mid-sentence with an ellipsis) to keep the layout from breaking
  // on extreme inputs.
  const messageText = (g.message ?? '').trim()
  const displayMessage = messageText.length > 280
    ? messageText.slice(0, 279).trimEnd() + '…'
    : messageText

  // Inline JSX for @vercel/og. Note the explicit `display: 'flex'`
  // everywhere — satori (the underlying renderer) requires it on every
  // non-leaf container, even ones that look like single-child wrappers.
  // Missing display: flex is the most common @vercel/og bug.
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #d4eeff 0%, #f6f1e7 55%, #f3ead7 100%)',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 90px 70px',
          // Fraunces by default; per-element fontStyle: 'italic' kicks
          // in for the message + signature where applicable.
          fontFamily: 'Fraunces',
        }}
      >
        {/* Header: wordmark + sender line. Lighter than the OG version
            because the message text below carries most of the weight. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <span style={{ fontSize: 28, color: '#5b6f4f', letterSpacing: '0.05em' }}>
            blossom
          </span>
          <span style={{ fontSize: 36, color: '#3d4b32', lineHeight: 1.2 }}>
            {senderLine}
          </span>
        </div>

        {/* Flower row — same SVG silhouettes as /api/og but at a
            smaller scale so the message gets to dominate. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '30px',
            marginTop: '40px',
            marginBottom: '40px',
          }}
        >
          {flowers.map((f, i) => (
            <FlowerSilhouette key={i} flower={f} />
          ))}
        </div>

        {/* Message block — centerpiece. Italicized to read as
            handwritten, generous line-height, signed below with an
            em-dash signature line if we have a from name. */}
        {displayMessage && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              padding: '30px 0',
              borderTop: '1px solid rgba(91, 111, 79, 0.2)',
              borderBottom: '1px solid rgba(91, 111, 79, 0.2)',
              flex: 1,
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontSize: 30,
                color: '#2f3a26',
                fontStyle: 'italic',
                lineHeight: 1.5,
                letterSpacing: '0.005em',
              }}
            >
              {displayMessage}
            </span>
            {g.from && (
              <span
                style={{
                  fontSize: 24,
                  color: '#5b6f4f',
                  fontStyle: 'italic',
                  alignSelf: 'flex-end',
                }}
              >
                — {g.from}
              </span>
            )}
          </div>
        )}

        {/* Footer: wordmark URL, quiet. Print-friendly: stays legible
            even when shared, screenshotted, and re-compressed. */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 'auto',
            paddingTop: '28px',
            color: '#7a8470',
          }}
        >
          <span style={{ fontSize: 20, letterSpacing: '0.05em' }}>
            blossom.aidenjang.com
          </span>
          {g.bouquetNote && (
            <span style={{ fontSize: 18, color: '#5b6f4f', fontStyle: 'italic', maxWidth: 520, textAlign: 'right' }}>
              {truncate(g.bouquetNote, 80)}
            </span>
          )}
        </div>
      </div>
    ),
    {
      width: CARD_SIZE,
      height: CARD_SIZE,
      fonts: [
        // Two registrations under the same name. satori picks one
        // based on the element's fontStyle — that's how the
        // message + signature get italic glyphs while the header +
        // wordmark get roman ones.
        { name: 'Fraunces', data: fonts.regular, style: 'normal', weight: 400 },
        { name: 'Fraunces', data: fonts.italic, style: 'italic', weight: 400 },
      ],
      headers: {
        // Per-garden content is immutable, so cache forever. The
        // Content-Disposition switches between inline (preview-friendly)
        // and attachment (download-on-click) based on the query flag.
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Disposition': opts.forceDownload
          ? `attachment; filename="${opts.filename}"`
          : `inline; filename="${opts.filename}"`,
      },
    },
  )
}

/**
 * Inline SVG flower silhouette — shared shape with /api/og.tsx but
 * scaled slightly smaller for the square card layout. Could be
 * extracted to a shared module, but duplicating ~30 lines is fine
 * given the two endpoints have meaningfully different layouts and
 * may diverge further.
 */
function FlowerSilhouette({ flower }: { flower: FlowerSpec }) {
  const [c1, c2] = flower.petalColors
  const petalCount = flower.petalCount || 8
  const center = { x: 60, y: 60 }
  const stemHeight = Math.min(flower.stemHeight || 90, 160)

  const petals = []
  for (let i = 0; i < petalCount; i++) {
    const angle = (i / petalCount) * Math.PI * 2
    const px = center.x + Math.cos(angle) * 20
    const py = center.y + Math.sin(angle) * 20
    petals.push(
      <ellipse
        key={i}
        cx={px}
        cy={py}
        rx={16}
        ry={24}
        transform={`rotate(${(angle * 180) / Math.PI + 90} ${px} ${py})`}
        fill={i % 2 === 0 ? c1 : c2}
      />,
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="110" height="110" viewBox="0 0 120 120">
        {petals}
        <circle cx={center.x} cy={center.y} r={12} fill={flower.centerColor} />
      </svg>
      <div
        style={{
          width: '5px',
          height: `${stemHeight}px`,
          background: flower.stemColor,
          borderRadius: '3px',
          marginTop: '-8px',
        }}
      />
    </div>
  )
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}
