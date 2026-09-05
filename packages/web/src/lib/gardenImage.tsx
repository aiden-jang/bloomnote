// Turning those pictures into a PNG somebody can keep: rasterize, prewarm, save, upload.
import { renderToStaticMarkup } from 'react-dom/server'
import type { FlowerSpec } from '../garden'
import {
  GardenDuetImage,
  H,
  OG_H,
  OG_W,
  OgCard,
  PressedFlowerImage,
  ShareImage,
  W,
  type GardenDuetImageOpts,
  type GardenImageOpts,
  type GardenImageSaveResult,
} from './imageCards'

export type { GardenDuetImageOpts, GardenImageOpts, GardenImageSaveResult }

async function rasterize(svg: string, w: number, h: number, dpr = 2): Promise<Blob> {
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    return await new Promise<Blob>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = w * dpr
        canvas.height = h * dpr
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('canvas unavailable'))
        ctx.scale(dpr, dpr)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((png) => (png ? resolve(png) : reject(new Error('encode failed'))), 'image/png')
      }
      img.onerror = () => reject(new Error('svg render failed'))
      img.src = svgUrl
    })
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

async function renderGardenPng(opts: GardenImageOpts): Promise<Blob> {
  return rasterize(renderToStaticMarkup(<ShareImage {...opts} />), W, H)
}

function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.download = filename
  a.href = href
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(href)
}

/* Render before it is asked for. `navigator.share` needs a live user gesture, and a 2160px
   garden takes long enough to rasterize that the gesture expires. */
let warmed: { key: string; png: Promise<Blob> } | null = null

export function warmKey(opts: GardenImageOpts): string {
  return JSON.stringify([
    opts.from,
    opts.to,
    opts.flowers.map((f) => `${f.name}:${f.stemHeight}:${f.petalColors[0]}`),
  ])
}

export function prewarmGardenImage(opts: GardenImageOpts): void {
  const key = warmKey(opts)
  if (warmed?.key === key) return
  // Swallowed here and re-thrown at save time, where there is a person to tell.
  warmed = { key, png: renderGardenPng(opts) }
  void warmed.png.catch(() => undefined)
}

async function gardenPng(opts: GardenImageOpts): Promise<Blob> {
  const key = warmKey(opts)
  if (warmed?.key === key) {
    try {
      return await warmed.png
    } catch {
      warmed = null // a failed warm should not poison every later attempt
    }
  }
  return renderGardenPng(opts)
}

export async function saveGardenImage(opts: GardenImageOpts): Promise<GardenImageSaveResult> {
  const blob = await gardenPng(opts)
  const base = (opts.to || 'garden').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  const filename = `bloomnote-${base}.png`
  const file = new File([blob], filename, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({
        files: [file],
        title: 'bloomnote',
        text: opts.to ? `A garden for ${opts.to}` : 'A garden',
      })
      return 'shared'
    } catch (err) {
      // The user dismissed the sheet. Done, don't also download.
      if (err instanceof Error && err.name === 'AbortError') return 'dismissed'
      // Anything else, lost user activation included, falls through to a plain download.
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

export async function saveGardenDuetImage(opts: GardenDuetImageOpts): Promise<GardenImageSaveResult> {
  const blob = await rasterize(renderToStaticMarkup(<GardenDuetImage {...opts} />), W, H)
  const participant = opts.current.to || opts.current.from || 'garden-duet'
  const base =
    participant
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'garden-duet'
  const filename = `bloomnote-duet-${base}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }

  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'a bloomnote duet', text: 'Two gardens, one little story' })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'dismissed'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

export async function saveFlowerImage(flower: FlowerSpec, meaning: string): Promise<GardenImageSaveResult> {
  const blob = await rasterize(
    renderToStaticMarkup(<PressedFlowerImage flower={flower} meaning={meaning} />),
    W,
    H,
  )
  const base =
    flower.name
      .replace(/[^a-z0-9]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'flower'
  const filename = `bloomnote-${base}.png`
  const file = new File([blob], filename, { type: 'image/png' })
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean }
  if (typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: flower.name, text: `${flower.name}: ${meaning}` })
      return 'shared'
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'dismissed'
    }
  }
  downloadBlob(blob, filename)
  return 'downloaded'
}

// A second composition at 1200x630, the size the shell's og:image tags already declare. The
// download card is square, which centre-crops in every large-image card slot and loses the
// headline first.
//
// Deliberately separate rather than the square one parameterised: fold them together and every
// future tweak to the download card silently changes what strangers see in a chat preview.
export async function uploadOgImage(id: string, opts: GardenImageOpts): Promise<void> {
  try {
    const svg = renderToStaticMarkup(<OgCard {...opts} />)
    // 1x for the card. 1200x630 is already the declared size, and a 2x PNG is around a megabyte,
    // over the Worker's cap and slower to unfurl than it is prettier.
    const png = await rasterize(svg, OG_W, OG_H, 1)
    await fetch(`/api/garden/${id}/og`, {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: png,
    })
  } catch {
    // Swallowed on purpose. See above.
  }
}
