// 1080×1920 vertical garden export for Instagram Stories / TikTok /
// Snapchat. Companion to /api/card (square 1080×1080); layouts diverge
// enough to justify a separate file rather than one parameterized
// render.

import { ImageResponse } from '@vercel/og'
import type { GardenData } from '../src/garden'
import { getFraunces } from './_lib/fonts'
import { getRedis } from './_lib/redis'
import FlowerSilhouette from './_lib/silhouette'

export const config = { runtime: 'edge' }

// 1080×1920 = exact 9:16. Instagram Stories crops UI chrome from top
// and bottom (~250px on each side, varies by device), so the visual
// "safe zone" is roughly the middle 70%. We lay out the meaningful
// content within those margins so nothing important gets clipped by
// the Stories UI.
const STORY_WIDTH = 1080
const STORY_HEIGHT = 1920
const TOP_SAFE_PADDING = 280
const BOTTOM_SAFE_PADDING = 280

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id || !/^[A-Za-z0-9]{4,12}$/.test(id)) {
    return new Response('Missing or malformed id.', { status: 400 })
  }

  const redis = getRedis()
  if (!redis) return new Response('Short URLs disabled.', { status: 503 })

  const raw = await redis.get(`g:${id}`)
  if (!raw) return new Response('Garden not found.', { status: 404 })
  const garden = raw as GardenData

  const forceDownload = url.searchParams.get('download') === '1'
  const safeSender = (garden.from || '').replace(/[^a-z0-9-]/gi, '-').slice(0, 40)
  const filename = safeSender ? `blossom-story-${safeSender}.png` : 'blossom-story.png'

  return renderStory(garden, { forceDownload, filename })
}

async function renderStory(
  g: GardenData,
  opts: { forceDownload: boolean; filename: string },
): Promise<Response> {
  const fonts = await getFraunces()
  // Stories crop tightly — fewer flowers in the row reads better than
  // a packed bouquet at this aspect ratio. Cap at 4.
  const flowers = (g.flowers ?? []).slice(0, 4)
  const senderLine = g.from
    ? `${g.from} grew ${g.to || 'you'} a garden`
    : `someone grew ${g.to || 'you'} a garden`

  // Tighter message cap for vertical — at 1080px wide with bigger
  // body type, ~200 chars is what fits before we start crowding the
  // signature.
  const messageText = (g.message ?? '').trim()
  const displayMessage =
    messageText.length > 200 ? messageText.slice(0, 199).trimEnd() + '…' : messageText

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background:
            'linear-gradient(180deg, #d4eeff 0%, #f6f1e7 45%, #f3ead7 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: `${TOP_SAFE_PADDING}px 90px ${BOTTOM_SAFE_PADDING}px`,
          fontFamily: 'Fraunces',
        }}
      >
        {/* Top: tiny wordmark. Stories live in feeds where the
            account name + "your story" UI already shows — we don't
            need a big brand mark here. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <span
            style={{
              fontSize: 28,
              color: '#5b6f4f',
              letterSpacing: '0.1em',
              textTransform: 'lowercase',
            }}
          >
            blossom
          </span>
          <span
            style={{
              fontSize: 46,
              color: '#2f3a26',
              lineHeight: 1.2,
              textAlign: 'center',
              maxWidth: 880,
            }}
          >
            {senderLine}
          </span>
        </div>

        {/* Middle: hero flowers. These are bigger than in the square
            card because the vertical canvas can carry them and Stories
            UX rewards a single dominant visual moment. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '50px',
          }}
        >
          {flowers.map((f, i) => (
            <FlowerSilhouette key={i} flower={f} size={160} stemWidth={7} maxStemHeight={300} />
          ))}
        </div>

        {/* Bottom: message + signature + footer. The message is the
            quiet emotional payload here — italic, plenty of leading,
            anchored bottom-left so the signature can sit right-aligned
            below it. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Each text block is wrapped in a flex div instead of being
              a bare <span>. Satori treats <span> as inline by default
              — without display: flex on every text container, multiple
              short spans pack onto one line regardless of the parent's
              column direction. The wrappers force each to be its own
              block-level child. */}
          {/* Plain <div> blocks with text rendered directly. Satori
              treats <span> as inline (packs horizontally regardless
              of parent flex direction) and treats <div> as a block.
              Each block here has `display: flex` + `width: 100%` to
              guarantee its own row under the column parent. */}
          {displayMessage && (
            <div
              style={{
                display: 'flex',
                width: '100%',
                fontSize: 38,
                color: '#2f3a26',
                fontStyle: 'italic',
                lineHeight: 1.5,
                letterSpacing: '0.005em',
              }}
            >
              {displayMessage}
            </div>
          )}

          {g.from && (
            <div
              style={{
                display: 'flex',
                width: '100%',
                justifyContent: 'flex-end',
                fontSize: 30,
                color: '#5b6f4f',
                fontStyle: 'italic',
              }}
            >
              — {g.from}
            </div>
          )}

          {g.bouquetNote && (
            <div
              style={{
                display: 'flex',
                width: '100%',
                fontSize: 22,
                color: '#3d6b32',
                fontStyle: 'italic',
                lineHeight: 1.5,
                paddingTop: '24px',
                borderTop: '1px solid rgba(91, 111, 79, 0.25)',
              }}
            >
              {truncate(g.bouquetNote, 110)}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              width: '100%',
              justifyContent: 'center',
              marginTop: '12px',
              fontSize: 22,
              color: '#7a8470',
              letterSpacing: '0.06em',
            }}
          >
            blossom.aidenjang.com
          </div>
        </div>
      </div>
    ),
    {
      width: STORY_WIDTH,
      height: STORY_HEIGHT,
      fonts: [
        { name: 'Fraunces', data: fonts.regular, style: 'normal', weight: 400 },
        { name: 'Fraunces', data: fonts.italic, style: 'italic', weight: 400 },
      ],
      headers: {
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
