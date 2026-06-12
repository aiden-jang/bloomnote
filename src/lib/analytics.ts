// Typed wrapper around Vercel Analytics's `track()` function.
//
// Why a wrapper instead of calling track() directly:
//   1. Event names are a closed enum — typos become type errors at the
//      call site instead of mystery splits in the dashboard between
//      e.g. `garden_generated` and `garden_genrated`.
//   2. Each event documents the exact shape of its props next to its
//      name, so it's obvious what's worth tracking.
//   3. One module to scan when adding a new event — no hunting through
//      Composer.tsx and RecipientView.tsx to remember what we already
//      named things.
//
// Privacy posture: no PII. We deliberately do NOT log message text,
// sender/recipient names, or anything from the garden contents — only
// structural metadata (counts, types, flags). The free Vercel
// Analytics tier is cookie-less and anonymizes IP + UA at the edge,
// so no cookie consent banner is required.

import { track } from '@vercel/analytics'

// The Vercel SDK accepts these property value types.
type EventProps = Record<string, string | number | boolean | null>

// All custom events flow through here. Wrapping it gives one place to
// add (e.g.) sample rates, prod/dev gating, or batched reporting later
// without touching call sites.
function emit(name: string, props?: EventProps): void {
  // No-op outside a browser context — protects against any future SSR
  // or test environment that imports this module.
  if (typeof window === 'undefined') return
  try {
    track(name, props)
  } catch {
    // Analytics failures must never affect the product.
  }
}

// --- Composer side -------------------------------------------------------

/**
 * The composer has loaded. Fired once per mount.
 * `mode` tells us whether the user landed fresh or on a /r/ remix URL.
 */
export function trackComposerOpened(mode: 'fresh' | 'remix'): void {
  emit('composer_opened', { mode })
}

/**
 * AI returned a valid garden. The structural props let us answer
 * questions like "do users typically include a from name?", "which
 * occasion is most popular?", or "which mood drives the highest
 * share rate?" — without ever logging note text.
 */
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

/**
 * Generation failed (model error, validation error, network).
 * `errorType` is a coarse bucket, not the raw error message —
 * raw messages would leak too much detail.
 */
export function trackGardenError(errorType: string): void {
  emit('garden_error', { errorType })
}

/** User aborted generation mid-stream. */
export function trackGardenCanceled(): void {
  emit('garden_canceled')
}

/** User copied the share link. Top of the share funnel. */
export function trackShareLinkCopied(): void {
  emit('share_link_copied')
}

/** User invoked the native share sheet. Mobile/Safari signal. */
export function trackShareLinkShared(): void {
  emit('share_link_shared')
}

/**
 * User downloaded a garden image.
 *
 *   `surface` — composer (sender side, fresh garden) vs recipient
 *     view (someone who received it). Sender downloads are more
 *     likely to drive new acquisition (posted on social); recipient
 *     downloads are usually personal keepsakes.
 *
 *   `format` — which dimension they grabbed. 'square' is the 1080×1080
 *     iMessage-friendly one; 'story' is the 1080×1920 Instagram-Stories
 *     vertical. Watching this split tells us which surface is actually
 *     driving the downloads — useful product signal.
 */
export function trackCardDownloaded(
  surface: 'composer' | 'recipient',
  format: 'square' | 'story',
): void {
  emit('card_downloaded', { surface, format })
}

/** User clicked "make another" after a successful design. */
export function trackMakeAnother(): void {
  emit('make_another')
}

/**
 * User clicked "different flowers" — regenerate the garden with the
 * same inputs. Useful signal: a spike here means the AI's first-shot
 * quality on certain inputs (occasion, mood combos) is unsatisfying.
 * The `attempt` counter tells us how many re-rolls happened in one
 * session before the user accepted a result.
 */
export function trackGardenRerolled(props: { attempt: number; durationMs: number }): void {
  emit('garden_rerolled', props)
}

// --- Recipient side ------------------------------------------------------

/**
 * Someone opened a /g/<encoded> URL. This is the *receive* event —
 * critical for measuring whether shared links actually get clicked.
 *
 * `hasThread` tells us if the garden was a reply (had a `previous`),
 * which is how we know the back-and-forth loop is actually happening.
 */
export function trackGardenOpened(props: {
  flowerCount: number
  hasFromName: boolean
  hasThread: boolean
}): void {
  emit('garden_opened', props)
}

/** Recipient tapped "open the garden" — the actual bloom moment. */
export function trackGardenBloomed(): void {
  emit('garden_bloomed')
}

/**
 * Someone clicked "grow one back" — they're about to go from
 * recipient to sender. This is the loop-close event; the funnel
 * we care about most is opened → bloomed → reply_started → generated.
 *
 * Fired on the recipient's outbound click, NOT on the composer's
 * inbound /r/ load — there's no perfect cross-session join, but a
 * click event is the cleanest signal we get.
 */
export function trackReplyStarted(): void {
  emit('reply_started')
}
