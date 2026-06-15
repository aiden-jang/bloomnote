// Per-garden Open Graph image. 1200×630 PNG rendered on demand and
// served via middleware.ts injecting `<meta og:image>` into /g/<id>
// responses, so link previews in iMessage/Slack/etc. show the actual
// shared garden instead of a generic placeholder.

import { ImageResponse } from '@vercel/og'
import type { GardenData } from '../src/garden'
import { getFraunces } from './_lib/fonts'
import { getRedis } from './_lib/redis'
import FlowerSilhouette from './_lib/silhouette'

export const config = { runtime: 'edge' }

// OG image dimensions are an industry standard. 1200×630 = 1.91:1
// aspect, which is what Facebook, Twitter, iMessage, and Slack all
// crop to. Anything else gets letterboxed or cropped weirdly.
const OG_WIDTH = 1200
const OG_HEIGHT = 630

export default async function handler(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get('id')

  // No ID, or bad-shaped ID → fall back to a generic OG image. This
  // also covers the case where a crawler hits /api/og?id= directly
  // with no query — Twitter does this occasionally.
  if (!id || !/^[A-Za-z0-9]{4,12}$/.test(id)) {
    return renderGeneric()
  }

  const redis = getRedis()
  if (!redis) return renderGeneric()

  const raw = await redis.get(`g:${id}`)
  if (!raw) return renderGeneric()

  // Upstash auto-parses JSON values stored as strings. We treat the
  // result as GardenData; any unexpected shape will be caught by the
  // optional chaining in the render below.
  const garden = raw as GardenData

  return renderForGarden(garden)
}

async function renderForGarden(g: GardenData): Promise<Response> {
  const fonts = await getFraunces()
  const senderLine = g.from
    ? `${g.from} grew ${g.to || 'you'} a garden`
    : `someone grew ${g.to || 'you'} a garden`

  // Take up to 5 flowers for the preview. More than that gets too
  // dense at this image size.
  const flowers = (g.flowers ?? []).slice(0, 5)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #d4eeff 0%, #f6f1e7 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '70px 80px',
          // Default to Fraunces for the whole canvas. Per-element
          // styles can still override (e.g. italic via fontStyle).
          fontFamily: 'Fraunces',
        }}
      >
        {/* Top: sender line + wordmark */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: 26, color: '#5b6f4f', letterSpacing: '0.04em' }}>
              blossom
            </span>
            <span style={{ fontSize: 44, color: '#2f3a26', maxWidth: 800, lineHeight: 1.15 }}>
              {senderLine}
            </span>
          </div>
        </div>

        {/* Middle: the actual flower row, drawn as inline SVG. We
            recreate a simplified version of FlowerSVG here because
            React Server Components inside @vercel/og can't import
            CSS modules or use our component library directly. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: '40px',
            flex: 1,
            paddingTop: '40px',
          }}
        >
          {flowers.map((f, i) => (
            <FlowerSilhouette key={i} flower={f} />
          ))}
        </div>

        {/* Bottom: ground line + bouquet note (if any) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {g.bouquetNote && (
            <span
              style={{
                fontSize: 24,
                color: '#3d6b32',
                fontStyle: 'italic',
                maxWidth: 1000,
                lineHeight: 1.4,
              }}
            >
              {truncate(g.bouquetNote, 140)}
            </span>
          )}
          <span style={{ fontSize: 18, color: '#7a8470', letterSpacing: '0.04em' }}>
            blossom.aidenjang.com
          </span>
        </div>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      // Register Fraunces in both styles so the JSX above can use
      // fontFamily: 'Fraunces' for headers and fontStyle: 'italic'
      // for the bouquet note. satori picks the right registration
      // based on style.
      fonts: [
        { name: 'Fraunces', data: fonts.regular, style: 'normal', weight: 400 },
        { name: 'Fraunces', data: fonts.italic, style: 'italic', weight: 400 },
      ],
      // Cache forever per garden — the contents never change, so the
      // image is safe to cache at every CDN edge. Crawlers will only
      // hit our origin once per share, then it's edge-cached.
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    },
  )
}

async function renderGeneric(): Promise<Response> {
  const fonts = await getFraunces()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #d4eeff 0%, #f6f1e7 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'Fraunces',
        }}
      >
        <span style={{ fontSize: 96, color: '#3d6b32', letterSpacing: '-0.02em' }}>
          blossom
        </span>
        <span style={{ fontSize: 36, color: '#5b6f4f', marginTop: '14px', fontStyle: 'italic' }}>
          write a note. we grow them a garden.
        </span>
      </div>
    ),
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        { name: 'Fraunces', data: fonts.regular, style: 'normal', weight: 400 },
        { name: 'Fraunces', data: fonts.italic, style: 'italic', weight: 400 },
      ],
      // Generic image is shorter-cached — if we ever change the
      // wordmark or tagline, we want crawlers to pick it up within
      // a day. Per-garden images cache forever (immutable above).
      headers: { 'Cache-Control': 'public, max-age=86400' },
    },
  )
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
}
