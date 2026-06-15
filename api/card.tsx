// Downloadable 1080×1080 garden card. Triggered by "save as image"
// in the UI; rendered server-side so pixel output is identical across
// browsers and there's no font-load race on the client.

import { ImageResponse } from '@vercel/og'
import type { GardenData } from '../src/garden'
import { getFraunces } from './_lib/fonts'
import { getRedis } from './_lib/redis'
import FlowerSilhouette from './_lib/silhouette'

export const config = { runtime: 'edge' }

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
            <FlowerSilhouette key={i} flower={f} size={110} stemWidth={5} maxStemHeight={160} />
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


function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}
