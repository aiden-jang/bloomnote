/*
 * The app's custom analytics events, behind one typed wrapper.
 *
 * Names are a closed set, so a typo is a type error at the call site rather than two half-populated
 * series in the dashboard that nobody notices for a month.
 *
 * No PII, deliberately: never note text, never names, never anything out of the garden itself, only
 * structural metadata. Recorded to Workers Logs with no cookie and no identifier, which is also why
 * no consent banner is needed.
 *
 * The funnel these exist to measure: opened → bloomed → reply_started → generated.
 */

type EventProps = Record<string, string | number | boolean | null>

/**
 * Fire-and-forget POST to the Worker's /api/event.
 *
 * sendBeacon first because it survives page unload — `garden_opened` often fires as the tab is
 * closing, and a plain fetch is cancelled with it. keepalive fetch is the fallback.
 */
function emit(name: string, props?: EventProps): void {
  if (typeof navigator === 'undefined') return
  const body = JSON.stringify({ name, meta: props ?? {} })
  try {
    if (navigator.sendBeacon?.('/api/event', body)) return
  } catch {
    // sendBeacon unavailable or threw — fall through to fetch.
  }
  void fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => undefined)
}

// --- Composer side -------------------------------------------------------

/** `mode` distinguishes a fresh landing from a /r/ remix URL. */
export function trackComposerOpened(mode: 'fresh' | 'remix'): void {
  emit('composer_opened', { mode })
}

export function trackGardenGenerated(props: {
  occasion: string
  /** One of the mood keys defined in src/lib/moods.ts, or 'none'. */
  mood: string
  flowerCount: number
  hasFromName: boolean
  isRemix: boolean
  durationMs: number
}): void {
  emit('garden_generated', props)
}

/** `errorType` is a coarse bucket, never the raw message — those can carry the model's output. */
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
/** 1080×1080 square, or the 1080×1920 story vertical. */
export type CardFormat = 'square' | 'story'

/** Sender-side saves tend to get posted; recipient-side ones are keepsakes. Worth telling apart. */
export function trackCardDownloaded(surface: DownloadSurface, format: CardFormat): void {
  emit('card_downloaded', { surface, format })
}

export function trackMakeAnother(): void {
  emit('make_another')
}

/** A spike here means the model's first shot is weak for some occasion/mood combination. */
export function trackGardenRerolled(props: { attempt: number; durationMs: number }): void {
  emit('garden_rerolled', props)
}

// --- Recipient side ------------------------------------------------------

/** Someone opened a share link. `hasThread` is how we know the back-and-forth actually happens. */
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

/**
 * Recipient is about to become a sender.
 *
 * Fired on their outbound click rather than the composer's inbound /r/ load: there is no clean
 * cross-session join, and the click is the closest honest signal.
 */
export function trackReplyStarted(): void {
  emit('reply_started')
}
