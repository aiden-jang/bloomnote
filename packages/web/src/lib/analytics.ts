import { canReportAnalytics } from '../../../../analytics/browser.js'
import { safeMeta } from '../../../../analytics/meta.js'
import type { PRODUCT_EVENTS } from '../../../../analytics/schema.js'
/* Event names are a closed set, so a typo is a type error rather than a line nobody ever queries. */

type EventProps = Record<string, string | number | boolean | null>

/** Keepalive survives navigation without attaching a garden URL or account cookie. */
function emit(name: (typeof PRODUCT_EVENTS)[number], props?: EventProps): void {
  if (!canReportAnalytics()) return
  try {
    void fetch('/api/event', {
      method: 'POST',
      credentials: 'omit',
      mode: 'same-origin',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, meta: safeMeta(props ?? {}) }),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    /* Best effort only; offline and blocked analytics never break a garden. */
  }
}

export function trackComposerOpened(mode: 'fresh' | 'remix'): void {
  emit('composer_opened', { mode })
}

export function trackGardenGenerated(props: {
  occasion: string
  mood: string
  flowerCount: number
  hasFromName: boolean
  isRemix: boolean
  durationMs: number
}): void {
  emit('garden_generated', props)
}

/** A coarse bucket, never the raw message: those can carry the model's output. */
export function trackGardenError(errorType: string): void {
  emit('garden_error', { errorType })
}

export function trackGardenCanceled(): void {
  emit('garden_canceled')
}

export function trackShareLinkCopied(): void {
  emit('share_link_copied')
}

export function trackShareLinkShared(): void {
  emit('share_link_shared')
}

export type DownloadSurface = 'composer' | 'recipient' | 'mine'
export type CardFormat = 'square' | 'story' | 'duet'

export function trackCardDownloaded(surface: DownloadSurface, format: CardFormat): void {
  emit('card_downloaded', { surface, format })
}

export function trackMakeAnother(): void {
  emit('make_another')
}

export function trackGardenRerolled(props: { attempt: number; durationMs: number }): void {
  emit('garden_rerolled', props)
}

export function trackGardenOpened(props: {
  flowerCount: number
  hasFromName: boolean
  hasThread: boolean
}): void {
  emit('garden_opened', props)
}

export function trackGardenBloomed(): void {
  emit('garden_bloomed')
}

export function trackGardenReshared(method: 'native' | 'copy'): void {
  emit('garden_reshared', { method })
}

export function trackReplyStarted(): void {
  emit('reply_started')
}
