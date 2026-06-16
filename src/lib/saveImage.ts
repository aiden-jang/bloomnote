// Saving the rendered card / story PNG, with a phone-friendly path.
//
// The save links are plain `<a download>` anchors. That works everywhere
// EXCEPT iOS, where the `download` attribute drops the file into the
// Files app — never Photos, which is where people expect a saved image
// to land.
//
// Fix, scoped to iOS: fetch the PNG and hand it to the OS share sheet,
// whose "Save Image" action stores it straight into Photos.
//
// We deliberately DON'T do this on Android. There a normal download goes
// to the Downloads folder, which MediaStore indexes — so it already
// shows up in the gallery / Google Photos. And the Android share sheet
// has no one-tap "save to gallery" action (it's for sharing to apps), so
// rerouting through it would be more friction for a worse result. Same
// for desktop: the direct download is exactly what people expect.

import type { MouseEvent } from 'react'
import { trackCardDownloaded } from './analytics'

// iPhone / iPod, plus iPadOS — which reports as desktop Safari but gives
// itself away with multiple touch points on a Mac platform string.
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return (
    /iP(hone|od|ad)/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

// Should this save route through the share sheet instead of a download?
// Only on iOS, and only when file-sharing is actually available.
function shouldSaveViaShare(): boolean {
  if (typeof navigator === 'undefined') return false
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false
  }
  if (!isIOS()) return false
  try {
    return (
      navigator.canShare?.({
        files: [new File([new Blob()], 'probe.png', { type: 'image/png' })],
      }) ?? false
    )
  } catch {
    return false
  }
}

// Programmatic download fallback for the rare case where we've fetched
// the blob but the share sheet won't take it.
function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Release the object URL once the download has had a beat to start.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

/**
 * Click handler for the "save as image / story" links. On a
 * share-capable phone it fetches the rendered PNG and opens the OS share
 * sheet, so tapping "Save Image" stores it in Photos. Everywhere else it
 * does nothing and lets the anchor's native `<a download>` proceed
 * (which also keeps right-click "save link as" working).
 *
 * The anchor's own href is the source of truth for the URL, so callers
 * just wire `onClick={e => saveSharedImage(e, surface, format)}`.
 */
export async function saveSharedImage(
  e: MouseEvent<HTMLAnchorElement>,
  surface: 'composer' | 'recipient',
  format: 'square' | 'story',
): Promise<void> {
  // Read the URL before any await — React clears currentTarget once the
  // synchronous part of the handler returns.
  const url = e.currentTarget.href
  const filename = format === 'story' ? 'blossom-story.png' : 'blossom-garden.png'

  if (!shouldSaveViaShare()) {
    // Android / desktop / unsupported: let the <a download> handle it.
    // (Android downloads land in the gallery-indexed Downloads folder.)
    trackCardDownloaded(surface, format)
    return
  }

  e.preventDefault()
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`save fetch failed: ${res.status}`)
    const blob = await res.blob()
    const file = new File([blob], filename, { type: 'image/png' })
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share?.({ files: [file] })
      trackCardDownloaded(surface, format)
      return
    }
    // Probe passed but this payload was rejected — fall back to download.
    downloadBlob(blob, filename)
    trackCardDownloaded(surface, format)
  } catch (err) {
    // User dismissed the share sheet: not a failure, and re-triggering a
    // download would be a surprise. Bail quietly.
    if (err instanceof DOMException && err.name === 'AbortError') return
    // Genuine failure (network, render): fall back to the download URL.
    window.location.href = url
  }
}
