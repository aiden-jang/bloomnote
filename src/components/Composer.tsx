import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ExampleCarousel from './ExampleCarousel'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import ScheduleInput from './ScheduleInput'
import ShareCard from './ShareCard'
import { type ExampleGarden } from '../data/exampleGardens'
import {
  buildShareUrl,
  createShortGarden,
  type FlowerSpec,
  type GardenData,
} from '../garden'
import {
  trackComposerOpened,
  trackGardenCanceled,
  trackGardenError,
  trackGardenGenerated,
  trackGardenRerolled,
  trackMakeAnother,
  trackShareLinkCopied,
  trackShareLinkShared,
} from '../lib/analytics'
import { designGarden, type DesignResult } from '../lib/designGarden'
import { formatGardenDate } from '../lib/formatDate'
import { DEFAULT_MOOD, MOODS } from '../lib/moods'
import { DEFAULT_OCCASION, OCCASIONS } from '../lib/occasions'
import { withViewTransition } from '../lib/viewTransition'
import { playSuccess, playWhoosh } from '../sound'
import styles from './Composer.module.css'

// Two phases instead of four. The message is the input; the garden +
// share link are the output. No second-phase "now add a message" step,
// because the message is already there.
type Phase = 'idle' | 'designing' | 'designed'

// Snapshot shape used by the clear-draft undo toast. Session-local
// only — the form deliberately doesn't persist across refresh.
interface Draft {
  from: string
  recipient: string
  message: string
  occasion: string
  mood: string
}

/**
 * Coarse bucket for analytics. Raw error messages can carry pieces of
 * the model's output (and indirectly, the user's note), so we map to
 * a small set of stable labels here and only ever log the label.
 */
/**
 * Pick a CSS modifier class for the char-count based on message
 * length. Teaches the user that longer notes get better gardens —
 * not via copy, just by quietly turning the count more confident as
 * the note grows. Anywhere past 320 nudges amber as a "you're near
 * the limit" warning.
 */
function charCountTierClass(len: number, styles: Record<string, string>): string {
  if (len === 0) return ''
  if (len < 40) return styles.charCountThin
  if (len < 320) return styles.charCountGood
  return styles.charCountNear
}

function classifyError(err: unknown): string {
  if (!(err instanceof Error)) return 'unknown'
  const m = err.message.toLowerCase()
  if (m.includes('abort')) return 'aborted'
  if (m.includes('rate')) return 'rate_limited'
  if (m.includes('timeout') || m.includes('timed out')) return 'timeout'
  if (m.includes('network') || m.includes('fetch')) return 'network'
  if (m.includes('validation') || m.includes('invalid')) return 'validation'
  return 'model'
}

const MESSAGE_PLACEHOLDERS = [
  "Happy birthday, Maya. You're the only person I know who keeps a tide journal AND laughs too loudly at her own jokes. You'd drive six hours to see a sunset and somehow always rope me in. So glad you exist.",
  "Mom, 60 years. You raised three kids on your own while finishing your degree at night, taught me how to garden, and still call every Sunday. I don't say thank you enough.",
  "Theo, the night I was applying to grad school you stayed up making sure I ate. The pour-over was the best part. I think about that a lot. Happy birthday, friend.",
]

interface ComposerProps {
  /** Optional remix seed; when present, the composer renders in
   *  reply mode (From/To pre-filled inverse, original shown as
   *  thread context, generated garden carries `previous`). */
  remixSeed?: GardenData
}

export default function Composer({ remixSeed }: ComposerProps = {}) {

  const [phase, setPhase] = useState<Phase>('idle')

  // Initial input values are computed once at mount.
  //   - In remix mode, pre-fill From/To from the inverse of the seed
  //     (we're replying, so the original sender becomes our recipient).
  //   - Otherwise, blank slate.
  // The form is deliberately ephemeral: refreshing the page wipes
  // whatever was typed. Recovery from accidental refresh is the
  // tradeoff; in exchange the user always lands on a fresh form
  // without stale drafts cluttering it.
  const initialInputs = useMemo(() => {
    const base = { occasion: DEFAULT_OCCASION, mood: DEFAULT_MOOD }
    if (remixSeed) {
      return {
        ...base,
        from: remixSeed.to ?? '',
        recipient: remixSeed.from ?? '',
        message: '',
      }
    }
    return { ...base, from: '', recipient: '', message: '' }
  }, [remixSeed])

  const [from, setFrom] = useState(initialInputs.from)
  const [recipient, setRecipient] = useState(initialInputs.recipient)
  const [message, setMessage] = useState(initialInputs.message)
  const [occasion, setOccasion] = useState(initialInputs.occasion)
  const [mood, setMood] = useState(initialInputs.mood)
  const [placeholder] = useState(
    () => MESSAGE_PLACEHOLDERS[Math.floor(Math.random() * MESSAGE_PLACEHOLDERS.length)],
  )

  // Time capsule: opt-in scheduled delivery. The UI is collapsed by
  // default ("send now") so first-time users aren't asked to think
  // about scheduling. When expanded, the datetime-local input lets
  // them pick a future moment — we validate it's at least a minute
  // ahead so a misclick doesn't ship an already-unlocked capsule.
  //
  // Value stored as local-datetime string (the format <input
  // type="datetime-local"> emits, e.g. "2026-09-15T14:30"). We
  // convert to ISO 8601 UTC at submit time.
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [unlockLocal, setUnlockLocal] = useState('')

  // Streaming progress.
  const [statusText, setStatusText] = useState<string>('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Re-roll state. Counts how many times the user regenerated the
  // current garden — feeds the analytics event and (when truthy)
  // gates the inline "regenerating…" status so the share card doesn't
  // disappear during the round-trip. Resets to 0 on every fresh
  // design (handleDesign) and on handleStartOver.
  const [rerollAttempt, setRerollAttempt] = useState(0)
  const [isRerolling, setIsRerolling] = useState(false)

  // Clear-draft undo. When the user clears, we keep a snapshot for a
  // few seconds so they can undo without confirmation dialogs.
  const [undoDraft, setUndoDraft] = useState<Draft | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Design result + share state. The scene starts empty — we don't
  // preview placeholder flowers anymore, because they set the wrong
  // expectation for what the AI will produce.
  const [garden, setGarden] = useState<DesignResult | null>(null)
  const [flowers, setFlowers] = useState<FlowerSpec[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  // The short ID is also captured separately because the "save as
  // image" button needs to build `/api/card?id=<id>` independently of
  // the (potentially shortened) display URL. Could be derived by
  // parsing shareUrl, but a dedicated piece of state is clearer than
  // a regex inside the JSX.
  const [gardenId, setGardenId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Web Share API is mobile + modern desktop Safari only. We detect on
  // mount and conditionally render — never show a button that won't
  // work. Detection runs in an effect because typeof navigator can
  // throw under some SSR pre-renders; this keeps the initial render
  // safe.
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  // Auto-focus the message textarea on remix mount — From/To are
  // pre-filled, so the natural cursor target is the empty note field.
  const messageRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (remixSeed && messageRef.current) {
      messageRef.current.focus()
    }
  }, [remixSeed])

  // Mobile keyboard handling. On iOS Safari, focusing the textarea
  // slides the virtual keyboard up — and frequently covers the
  // bottom half of the field the user just tapped. The browser's
  // own scroll-on-focus heuristic isn't reliable across versions.
  //
  // Fix: on focus, schedule a scrollIntoView(center) 300ms later —
  // enough for the keyboard's slide animation to complete so the
  // browser knows the new viewport height. The behavior is benign
  // on desktop (block: 'center' is a no-op when the element is
  // already in view).
  useEffect(() => {
    const ta = messageRef.current
    if (!ta) return
    const onFocus = () => {
      window.setTimeout(() => {
        ta.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }, 300)
    }
    ta.addEventListener('focus', onFocus)
    return () => ta.removeEventListener('focus', onFocus)
  }, [])

  // Analytics: composer opened. Fired once per mount so we get an
  // accurate "fresh vs remix landing" split. StrictMode double-mounts
  // in dev would inflate this by 2x — that's tolerable noise because
  // production doesn't double-mount.
  useEffect(() => {
    trackComposerOpened(remixSeed ? 'remix' : 'fresh')
  }, [remixSeed])

  // Live validation for the schedule input. Returns null when fine,
  // a user-facing string when not. Three states matter:
  //   - schedule closed → always valid (no input to check)
  //   - schedule open but no value picked → "pick a time" feedback
  //     (returned only after the user has touched the field, to avoid
  //     yelling at them the instant they expand the picker)
  //   - schedule open with a past value → hard error
  //
  // The 30-second grace window matches the server-side check in
  // handleDesign so "I picked 2:00 and submitted at 1:59:58" doesn't
  // disagree between the UI guard and the server. Without that grace
  // window, a user could pick a time, sit on the page for the few
  // seconds it takes for it to pass, and silently drop the schedule.
  const scheduleError: string | null = (() => {
    if (!scheduleOpen) return null
    if (!unlockLocal) return null  // empty is "not yet decided", not an error
    const t = new Date(unlockLocal).getTime()
    if (!Number.isFinite(t)) return 'that time looks malformed.'
    if (t <= Date.now() + 30_000) return "that time has already passed. pick something in the future."
    return null
  })()

  const canSubmit =
    recipient.trim().length >= 1 &&
    message.trim().length >= 4 &&
    scheduleError === null

  const handleDesign = useCallback(async () => {
    if (!canSubmit) return
    // Fresh design — clear any prior re-roll counter so analytics
    // reflect "this user re-rolled N times after THIS specific
    // generation," not lifetime counts.
    setRerollAttempt(0)
    // Cross-fade form → designing panel via View Transitions API.
    withViewTransition(() => {
      setPhase('designing')
      setErrorText(null)
      setStatusText('reading…')
    })

    const ctrl = new AbortController()
    abortRef.current = ctrl

    // Captured at the start of the request so we can report total
    // perceived design latency (model + validation + shortener).
    const startedAt = performance.now()

    try {
      playWhoosh()
      const result = await designGarden(
        {
          message: message.trim(),
          recipient: recipient.trim(),
          from: from.trim() || undefined,
          occasion,
          // 'none' (default) tells the server not to inject any mood
          // guidance — we send it through verbatim and let the server's
          // validation decide what to do. Keeps the wire format honest.
          mood,
        },
        {
          signal: ctrl.signal,
          onThinking: () => setStatusText('thinking…'),
        },
      )
      setGarden(result)
      setFlowers(result.flowers)

      // The garden record bundles the new garden AND (if this is a
      // reply) the original garden as `previous`. Depth-capped at 1:
      // we strip `previous` from the seed before attaching it, so a
      // five-message thread doesn't accumulate five nested gardens.
      // The recipient view only renders one level back anyway —
      // deeper history would be wasted storage and would slow the
      // fetch with no UX upside.
      const seedForPrevious = remixSeed
        ? { ...remixSeed, previous: undefined }
        : undefined
      // Convert the optional schedule input to a UTC ISO string. We
      // also clamp out values that are in the past (e.g. user picked a
      // time, then sat on the page until it passed) — sending an
      // already-unlocked capsule would be a confusing no-op.
      let unlockAt: string | undefined
      if (scheduleOpen && unlockLocal) {
        const t = new Date(unlockLocal).getTime()
        if (Number.isFinite(t) && t > Date.now() + 30_000) {
          unlockAt = new Date(t).toISOString()
        }
      }

      const data: GardenData = {
        flowers: result.flowers,
        bouquetNote: result.bouquetNote,
        message: message.trim(),
        from: from.trim(),
        to: recipient.trim(),
        // Stamp when the sender hit "Grow their garden" — shows up
        // on the recipient's view as a card-like "Grown {date}" line.
        createdAt: new Date().toISOString(),
        unlockAt,
        // Persist occasion + mood so the recipient view can shift its
        // sky gradient (and future mood-driven UI) to match what the
        // sender chose. Both are optional on the type, but we always
        // include them on new records — keeps every new garden a
        // first-class citizen of every UI surface that consumes them.
        occasion,
        mood,
        previous: seedForPrevious,
      }

      // POST the garden to our own /api/garden endpoint to get a short
      // ID back. We stay in 'designing' phase until the round-trip
      // completes — usually <200ms because the endpoint runs on the
      // same Edge network as the model call we just made.
      //
      // If the shortener fails (Upstash down, missing creds, network),
      // we surface a clear error rather than degrading silently to a
      // 450-char URL. The garden the user just spent 5 seconds
      // designing is wasted in that scenario, which is unfortunate —
      // but a broken share experience is worse than a clear failure.
      setStatusText('preparing link…')

      const SHORTEN_TIMEOUT_MS = 3000
      const shortId = await Promise.race([
        createShortGarden(data, ctrl.signal),
        new Promise<null>(resolve => setTimeout(() => resolve(null), SHORTEN_TIMEOUT_MS)),
      ])
      if (!shortId) {
        throw new Error("couldn't save your garden. try again?")
      }
      const finalUrl = buildShareUrl(shortId)

      // Cross-fade designing panel → designed preview. playSuccess
      // stays outside the transition so the chime plays at the start
      // of the visual change, not after it.
      playSuccess()
      withViewTransition(() => {
        setShareUrl(finalUrl)
        setGardenId(shortId)
        setStatusText('')
        setPhase('designed')
      })

      // Funnel event: garden_generated. Includes structural metadata
      // (occasion, flower count, whether the user provided a name)
      // but NEVER the note text or names themselves.
      trackGardenGenerated({
        occasion,
        mood,
        flowerCount: result.flowers.length,
        hasFromName: from.trim().length > 0,
        isRemix: !!remixSeed,
        durationMs: Math.round(performance.now() - startedAt),
      })
    } catch (err) {
      if (ctrl.signal.aborted) {
        withViewTransition(() => setPhase('idle'))
        trackGardenCanceled()
        return
      }
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      withViewTransition(() => {
        setErrorText(msg)
        setPhase('idle')
      })
      // Coarse error bucket. We classify by error shape rather than
      // logging the raw message — raw model error text can include
      // bits of the user's note or internal prompt details.
      trackGardenError(classifyError(err))
    } finally {
      abortRef.current = null
    }
  }, [canSubmit, from, message, mood, occasion, recipient, remixSeed, scheduleOpen, unlockLocal])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** Re-roll: regenerate the garden with the same inputs. Stays in
   *  the designed phase (only the URL pill flips to "regenerating…")
   *  to avoid losing the user's place. On failure restores the previous
   *  garden so a bad reroll doesn't discard their first-shot result. */
  const handleReroll = useCallback(async () => {
    if (isRerolling) return
    // Snapshot the current garden so we can restore on failure.
    const prevGarden = garden
    const prevFlowers = flowers
    const prevShareUrl = shareUrl
    const prevGardenId = gardenId

    setIsRerolling(true)
    setStatusText('regenerating…')
    setErrorText(null)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const startedAt = performance.now()
    const attempt = rerollAttempt + 1

    try {
      const result = await designGarden(
        {
          message: message.trim(),
          recipient: recipient.trim(),
          from: from.trim() || undefined,
          occasion,
          mood,
        },
        { signal: ctrl.signal },
      )

      // Compute the same unlockAt + seed-for-previous logic as
      // handleDesign so re-rolls preserve schedule and reply context.
      let unlockAt: string | undefined
      if (scheduleOpen && unlockLocal) {
        const t = new Date(unlockLocal).getTime()
        if (Number.isFinite(t) && t > Date.now() + 30_000) {
          unlockAt = new Date(t).toISOString()
        }
      }
      const seedForPrevious = remixSeed
        ? { ...remixSeed, previous: undefined }
        : undefined

      const data: GardenData = {
        flowers: result.flowers,
        bouquetNote: result.bouquetNote,
        message: message.trim(),
        from: from.trim(),
        to: recipient.trim(),
        createdAt: new Date().toISOString(),
        unlockAt,
        occasion,
        mood,
        previous: seedForPrevious,
      }

      const shortId = await createShortGarden(data, ctrl.signal)
      if (!shortId) {
        throw new Error("couldn't save the new garden. try again?")
      }

      // GardenScene re-keys on flower signature change, so the new
      // flowers re-bloom from sprout on render. That's the entire
      // animation — no extra orchestration needed.
      setGarden(result)
      setFlowers(result.flowers)
      setShareUrl(buildShareUrl(shortId))
      setGardenId(shortId)
      setStatusText('')
      setRerollAttempt(attempt)

      trackGardenRerolled({
        attempt,
        durationMs: Math.round(performance.now() - startedAt),
      })
    } catch (err) {
      if (ctrl.signal.aborted) {
        // User canceled mid-reroll — restore the snapshot and exit
        // quietly. No analytics event; this isn't a meaningful action.
        setGarden(prevGarden)
        setFlowers(prevFlowers)
        setShareUrl(prevShareUrl)
        setGardenId(prevGardenId)
        setStatusText('')
        return
      }
      // Failure: keep the previous garden visible, surface the error
      // text. The user's first-shot result isn't lost.
      setGarden(prevGarden)
      setFlowers(prevFlowers)
      setShareUrl(prevShareUrl)
      setGardenId(prevGardenId)
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setErrorText(msg)
      setStatusText('')
      trackGardenError(classifyError(err))
    } finally {
      abortRef.current = null
      setIsRerolling(false)
    }
  }, [
    isRerolling,
    garden,
    flowers,
    shareUrl,
    gardenId,
    rerollAttempt,
    message,
    recipient,
    from,
    occasion,
    mood,
    remixSeed,
    scheduleOpen,
    unlockLocal,
  ])

  const handleStartOver = useCallback(() => {
    // Cross-fade designed view → fresh, empty idle form. "Make another"
    // means "I'm done with this garden, start me clean" — re-typing
    // is the right default. If you want to tweak the same note and
    // regenerate, the clear-draft / undo flow is the explicit path.
    withViewTransition(() => {
      setPhase('idle')
      setGarden(null)
      setFlowers([])
      setShareUrl(null)
      setGardenId(null)
      setErrorText(null)
      setFrom('')
      setRecipient('')
      setMessage('')
      setOccasion(DEFAULT_OCCASION)
      setMood(DEFAULT_MOOD)
      setRerollAttempt(0)
    })
    trackMakeAnother()
  }, [])

  // Only show the clear link when there's something to clear. Trimmed
  // so "  " in a field doesn't count as draft content.
  const hasDraft =
    from.trim().length > 0 || recipient.trim().length > 0 || message.trim().length > 0

  // Example-carousel pick. Pre-fills every input so the user can hit
  // "grow their garden" immediately and experience the bloom moment
  // without typing. Scrolls the message textarea into focus afterward
  // — they can edit if they want, but the path of least resistance is
  // already prepared for them.
  const handleExampleSelect = useCallback((g: ExampleGarden) => {
    setFrom(g.from)
    setRecipient(g.to)
    setMessage(g.message)
    setOccasion(g.occasion)
    setMood(g.mood)
    // Defer focus to next tick so the value-change DOM updates flush
    // first. Some browsers refuse to set focus on an element that's
    // mid-controlled-update.
    setTimeout(() => {
      messageRef.current?.focus()
      // Move cursor to end so they can append/edit naturally.
      const t = messageRef.current
      if (t) t.setSelectionRange(t.value.length, t.value.length)
    }, 0)
  }, [])

  const handleClear = useCallback(() => {
    // Snapshot before wiping so undo works. If a previous undo was
    // pending, cancel its timer — the new clear takes precedence.
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    const snapshot: Draft = { from, recipient, message, occasion, mood }

    // Clearing is a quick local action; no view transition needed.
    // React batches these updates automatically in an event handler.
    setFrom('')
    setRecipient('')
    setMessage('')
    setOccasion(DEFAULT_OCCASION)
    setMood(DEFAULT_MOOD)
    setUndoDraft(snapshot)

    undoTimerRef.current = setTimeout(() => {
      setUndoDraft(null)
      undoTimerRef.current = null
    }, 8000)
  }, [from, recipient, message, occasion, mood])

  const handleUndoClear = useCallback(() => {
    if (!undoDraft) return
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setFrom(undoDraft.from)
    setRecipient(undoDraft.recipient)
    setMessage(undoDraft.message)
    setOccasion(undoDraft.occasion || DEFAULT_OCCASION)
    setMood(undoDraft.mood || DEFAULT_MOOD)
    setUndoDraft(null)
  }, [undoDraft])

  const handleCopy = useCallback(() => {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
    trackShareLinkCopied()
  }, [shareUrl])

  // Native share — opens the OS share sheet on mobile (iMessage, WhatsApp,
  // Slack, etc.) or desktop Safari. AbortError is a user cancellation,
  // not a failure; swallow it. Any other error falls through silently
  // and the user still has the Copy button.
  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    const data: ShareData = {
      title: 'Blossom',
      text: recipient.trim() ? `A garden for ${recipient.trim()}` : 'A garden for you',
      url: shareUrl,
    }
    try {
      await navigator.share(data)
      trackShareLinkShared()
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      // Otherwise no-op — the Copy button is still there as fallback.
    }
  }, [shareUrl, recipient])

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>blossom</h1>
        <p className={styles.subtitle}>
          {remixSeed
            ? `write ${remixSeed.from || 'them'} back.`
            : 'write a note. we grow them a garden.'}
        </p>
      </header>

      <GardenScene
        flowers={flowers}
        autoBloom
        // Live-shift the sky as the user changes the occasion picker.
        // The CSS transition on .sky's background cross-fades the
        // gradient, so the user sees the atmosphere respond to their
        // choice within the same composer view — small product win.
        occasion={occasion}
        key={garden ? garden.flowers.map(f => f.name).join('-') : 'empty'}
      />

      {/* Remix context — shown above the form when the user is replying
          to a garden they received. Gives them the original thread to
          glance back at while writing. */}
      {phase === 'idle' && remixSeed && (
        <RemixContext
          previous={remixSeed}
          label={remixSeed.from ? `replying to ${remixSeed.from}` : 'replying'}
        />
      )}

      {/* Onboarding carousel — only shown when (a) the composer is
          idle, (b) this is a fresh visit (no remix seed), and (c) the
          user hasn't started typing yet. The moment any of those
          change, the carousel hides itself so we're not occupying
          screen space with discovery affordances during composition. */}
      {phase === 'idle' && !remixSeed && !hasDraft && (
        <ExampleCarousel onSelect={handleExampleSelect} />
      )}

      {phase === 'idle' && (
        <>
          <div className={styles.nameRow}>
            <section className={styles.section}>
              <label className={styles.label}>From</label>
              <input
                className={styles.input}
                placeholder="Your name"
                value={from}
                onChange={e => setFrom(e.target.value)}
                maxLength={60}
              />
            </section>
            <section className={styles.section}>
              <label className={styles.label}>To</label>
              <input
                className={styles.input}
                placeholder="Their name"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                maxLength={60}
              />
            </section>
          </div>

          {/* Occasion + Mood — two-up so it's clear they're a paired
              control. Occasion is *when* (calendar), mood is *how*
              (emotional register). Both optional from the user's
              perspective (mood defaults to "no mood"), but always sent
              so the AI gets the full signal. */}
          <div className={styles.pickerRow}>
            <section className={styles.section}>
              <label className={styles.label} htmlFor="occasion-select">Occasion</label>
              <select
                id="occasion-select"
                className={styles.select}
                value={occasion}
                onChange={e => setOccasion(e.target.value)}
              >
                {OCCASIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </section>
            <section className={styles.section}>
              <label className={styles.label} htmlFor="mood-select">Mood</label>
              <select
                id="mood-select"
                className={styles.select}
                value={mood}
                onChange={e => setMood(e.target.value)}
              >
                {MOODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </section>
          </div>

          <section className={styles.section}>
            <label className={styles.label}>Your message</label>
            <textarea
              ref={messageRef}
              className={styles.textarea}
              placeholder={placeholder}
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={6}
              maxLength={400}
            />
            <div className={styles.helperRow}>
              <span className={styles.helper}>
                quirks beat vibes. the more specific, the better the bouquet.
              </span>
              <span
                className={`${styles.charCount} ${charCountTierClass(message.length, styles)}`}
              >
                {message.length}/400
              </span>
            </div>
          </section>

          <ScheduleInput
            open={scheduleOpen}
            value={unlockLocal}
            error={scheduleError}
            onOpen={() => setScheduleOpen(true)}
            onChange={setUnlockLocal}
            onCancel={() => {
              setScheduleOpen(false)
              setUnlockLocal('')
            }}
          />

          {errorText && <div className={styles.error}>{errorText}</div>}

          <div className={styles.actions}>
            <button
              className={styles.generateBtn}
              onClick={handleDesign}
              disabled={!canSubmit}
            >
              {remixSeed ? 'grow one back' : 'grow their garden'}
            </button>
          </div>

          {remixSeed && (
            <p className={styles.escape}>
              {/* href is "/" so the link navigates to the composer
                  root regardless of which route the user is currently
                  on (e.g. /r/<encoded>). */}
              <a href="/">or start fresh</a>
            </p>
          )}

          {/* Clear-draft link. Only shows when there's actually
              something to clear so it doesn't sit there as a dead
              control on a fresh form. */}
          {!remixSeed && hasDraft && (
            <p className={styles.escape}>
              <button
                type="button"
                className={styles.clearBtn}
                onClick={handleClear}
              >
                clear draft
              </button>
            </p>
          )}
        </>
      )}

      {phase === 'designing' && (
        <div className={styles.designingPanel}>
          <div className={styles.designingRow}>
            <Spinner />
            <span>{statusText || 'designing…'}</span>
          </div>
          <button className={styles.cancelBtn} onClick={handleCancel}>
            cancel
          </button>
        </div>
      )}

      {undoDraft && (
        <div className={styles.undoToast} role="status" aria-live="polite">
          <span>draft cleared</span>
          <button type="button" className={styles.undoBtn} onClick={handleUndoClear}>
            undo
          </button>
        </div>
      )}

      {phase === 'designed' && garden && shareUrl && (
        <>
          {/* Preview section — together with the GardenScene above,
              this renders exactly what the recipient will see when
              they open the share link, minus their own CTAs. The
              labeled header sets expectation explicitly so the user
              doesn't have to wonder "is this what they'll see?" */}
          <p className={styles.previewLabel}>
            {recipient.trim()
              ? `what ${recipient.trim()} sees`
              : 'what they see'}
          </p>

          <p className={styles.previewSenderLine}>
            {from.trim() ? (
              <>
                <span className={styles.previewFromName}>{from.trim()}</span>
                {' grew '}
                {recipient.trim() || 'them'}
                {' a garden'}
              </>
            ) : (
              `Someone grew ${recipient.trim() || 'them'} a garden`
            )}
          </p>

          {/* bouquetNote moved into FlowerLegend's "?" disclosure
              below — consolidates the AI's rationale into one place
              instead of splitting overall (here) vs per-flower (below). */}

          {message.trim() && (
            <div className={styles.previewMessage}>
              <p className={styles.previewMessageText}>{message.trim()}</p>
              {from.trim() && (
                <p className={styles.previewSig}>— {from.trim()}</p>
              )}
              <p className={styles.previewGrownOn}>
                grown {formatGardenDate(new Date().toISOString())}
              </p>
            </div>
          )}

          <FlowerLegend flowers={garden.flowers} bouquetNote={garden.bouquetNote} />

          {/* Divider separating "what they'll see" from "how you share it." */}
          <hr className={styles.shareDivider} aria-hidden />

          <ShareCard
            shareUrl={shareUrl}
            gardenId={gardenId}
            recipient={recipient}
            copied={copied}
            canShare={canShare}
            isRerolling={isRerolling}
            errorText={errorText}
            statusText={statusText}
            scheduleOpen={scheduleOpen}
            unlockLocal={unlockLocal}
            onShare={handleShare}
            onCopy={handleCopy}
            onReroll={handleReroll}
            onStartOver={handleStartOver}
          />

        </>
      )}

      {/* Footer. One quiet line by default; the privacy detail expands
          on tap. <details>/<summary> is keyboard- and screen-reader-
          friendly and free of JS. */}
      <footer className={styles.footer}>
        <p className={styles.credit}>
          made by{' '}
          <a href="https://www.aidenjang.com" target="_blank" rel="noreferrer">
            aiden jang
          </a>
          {' · '}
          <details className={styles.privacyDetails}>
            <summary className={styles.privacySummary}>privacy</summary>
            <span className={styles.privacyBody}>
              your note goes to gemini and sits behind your share link.
              i don't track what you wrote or who you sent it to.
            </span>
          </details>
        </p>
      </footer>
    </div>
  )
}

// On-brand loading indicator. Stem grows up, a small leaf unfurls at
// the top, both retract, loops. Way more "Blossom" than a generic
// rotating arc. Two simple keyframe animations with offset timing
// give it a breathing rhythm.
function Spinner() {
  return (
    <span className={styles.spinner} aria-hidden>
      <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
        <line
          x1="10"
          y1="26"
          x2="10"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.sproutStem}
        />
        <path
          d="M 10 14 Q 17 9, 14 16 Q 11 15, 10 14"
          fill="currentColor"
          className={styles.sproutLeaf}
        />
      </svg>
    </span>
  )
}

