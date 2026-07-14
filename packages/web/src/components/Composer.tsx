import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BouquetNote from './BouquetNote'
import ExampleCarousel from './ExampleCarousel'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import ScheduleInput from './ScheduleInput'
import ShareCard from './ShareCard'
import SoundToggle from './SoundToggle'
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
import { saveGardenImage } from '../lib/gardenImage'
import { formatGardenDate } from '../lib/formatDate'
import {
  countSentGardens,
  recordSentGarden,
  updateSentGardenId,
  type MineRecord,
} from '../lib/mine'
import { DEFAULT_MOOD, MOODS } from '../lib/moods'
import { DEFAULT_OCCASION, OCCASIONS } from '../lib/occasions'
import { placeholderFor } from '../lib/placeholders'
import { withViewTransition } from '../lib/viewTransition'
import { playSuccess, playWhoosh } from '../sound'
import styles from './Composer.module.css'

// Two phases instead of four. The message is the input; the garden +
// share link are the output. No second-phase "now add a message" step,
// because the message is already there.
type Phase = 'idle' | 'designing' | 'designed'

// Rotated through while the model is thinking (the longest part of the wait), so a multi-second
// generation feels like the garden is being made rather than a spinner hanging. Lowercase to match.
const THINKING_MESSAGES = [
  'reading between the lines…',
  'choosing flowers…',
  'mixing the palette…',
  'arranging the bouquet…',
  'writing the note…',
]

// Snapshot shape used by the clear-draft undo toast. Session-local
// only — the form deliberately doesn't persist across refresh. Captures
// the schedule state too, so clearing collapses the picker and undo can
// bring it back exactly as it was.
interface Draft {
  from: string
  recipient: string
  message: string
  occasion: string
  mood: string
  scheduleOpen: boolean
  unlockLocal: string
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
  if (len < 40) return styles.charCountThin ?? ''
  if (len < 320) return styles.charCountGood ?? ''
  return styles.charCountNear ?? ''
}

/**
 * Build the thin on-device archive summary for a just-created garden.
 * Pulls names/occasion/mood from the stored record and one
 * representative petal color per flower (capped at 5) for the swatch
 * chip on /mine. Kept out of the handlers so handleDesign and
 * handleReroll stay in sync on what gets archived.
 */
function buildMineRecord(id: string, data: GardenData): MineRecord {
  return {
    id,
    to: data.to ?? '',
    from: data.from ?? '',
    occasion: data.occasion,
    mood: data.mood,
    createdAt: data.createdAt ?? new Date().toISOString(),
    unlockAt: data.unlockAt,
    swatches: data.flowers.map(f => f.petalColors[0]).slice(0, 5),
  }
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

interface ComposerProps {
  /** Optional remix seed; when present, the composer renders in
   *  reply mode (From/To pre-filled inverse, original shown as
   *  thread context, generated garden carries `previous`). */
  remixSeed?: GardenData | undefined
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
  // Curated example that follows the selected occasion + mood, so the empty
  // field previews the kind of note those choices suggest.
  const placeholder = placeholderFor(occasion, mood)

  // How many gardens this device has sent — gates the "your gardens"
  // footer link so it never shows for a first-time visitor with an
  // empty archive. Seeded from storage at mount and bumped after each
  // successful design (re-rolls update in place, so they don't change
  // the count).
  const [mineCount, setMineCount] = useState(() => countSentGardens())

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
  const [thinking, setThinking] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Guards against a double-tap firing two generations: the button doesn't unmount until the view
  // transition swaps the DOM, so without this a fast second tap runs designGarden twice.
  const designingRef = useRef(false)
  // Same idea for save-as-image: don't open two share sheets / two downloads on a double-tap.
  const savingImageRef = useRef(false)

  // While the model is thinking, cycle the status line so the wait feels alive. Cleanup stops it
  // when thinking ends (or the component unmounts).
  useEffect(() => {
    if (!thinking) return
    let i = 0
    setStatusText(THINKING_MESSAGES[0]!)
    const id = setInterval(() => {
      i = (i + 1) % THINKING_MESSAGES.length
      setStatusText(THINKING_MESSAGES[i]!)
    }, 2500)
    return () => clearInterval(id)
  }, [thinking])

  // Safety net: any exit from the designing phase (success, error, cancel) stops the rotation.
  useEffect(() => {
    if (phase !== 'designing') setThinking(false)
  }, [phase])

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
  // The short ID is captured separately from the (potentially shortened) display share URL —
  // it's used to record the garden in the on-device archive / account. Clearer as its own
  // piece of state than a regex over shareUrl.
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

  // One source of truth for "can we submit — and if not, why not?" The
  // reason renders under the button so a disabled control always explains
  // itself, and `canSubmit` is just "nothing is blocking it." Ordered by
  // what to fix first: the core inputs (To + message), then the schedule.
  // ("From" is optional, so it's never a blocker.)
  const disabledReason: string | null = (() => {
    const noRecipient = recipient.trim().length < 1
    const noMessage = message.trim().length < 4
    if (noRecipient && noMessage) return 'add who it’s for and a message to get started'
    if (noRecipient) return 'add who it’s for in the “to” field'
    if (noMessage) return 'write them a message first'
    // Past/malformed schedule time: the picker shows the specifics inline,
    // so point back to it rather than repeating its sentence here. (An
    // empty unlockLocal keeps scheduleError null — that's the next case,
    // where the picker is open but nothing's been chosen yet.)
    if (scheduleError) return 'fix the scheduled time above'
    if (scheduleOpen && unlockLocal === '') {
      return 'pick a date & time above to schedule, or hit cancel to send now'
    }
    return null
  })()

  const canSubmit = disabledReason === null

  // Assemble the persisted garden record from a fresh design result plus
  // the current form state. Shared by the initial design and re-roll so
  // the two can't drift on schedule handling or reply-thread depth.
  const buildGardenData = useCallback(
    (result: DesignResult): GardenData => {
      // Convert the optional schedule input to a UTC ISO string, clamping
      // out past values (user picked a time, then sat on the page until it
      // passed — an already-unlocked capsule would be a confusing no-op).
      // The 30-second grace matches the server-side check.
      let unlockAt: string | undefined
      if (scheduleOpen && unlockLocal) {
        const t = new Date(unlockLocal).getTime()
        if (Number.isFinite(t) && t > Date.now() + 30_000) {
          unlockAt = new Date(t).toISOString()
        }
      }
      // Depth-cap replies at 1: strip `previous` from the seed before
      // attaching it, so a long thread doesn't nest N gardens deep. The
      // recipient view only renders one level back anyway.
      const seedForPrevious = remixSeed
        ? { ...remixSeed, previous: undefined }
        : undefined
      return {
        flowers: result.flowers,
        bouquetNote: result.bouquetNote,
        message: message.trim(),
        from: from.trim(),
        to: recipient.trim(),
        // Stamp when the sender hit "Grow their garden" — shows up on the
        // recipient's view as a card-like "Grown {date}" line.
        createdAt: new Date().toISOString(),
        unlockAt,
        // Persist occasion + mood so the recipient view can shift its sky
        // gradient (and future mood-driven UI) to match the sender's choice.
        occasion,
        mood,
        previous: seedForPrevious,
      }
    },
    [scheduleOpen, unlockLocal, remixSeed, message, from, recipient, occasion, mood],
  )

  const handleDesign = useCallback(async () => {
    if (!canSubmit || designingRef.current) return
    designingRef.current = true
    // Fresh design — clear any prior re-roll counter so analytics
    // reflect "this user re-rolled N times after THIS specific
    // generation," not lifetime counts.
    setRerollAttempt(0)
    // Cross-fade form → designing panel via View Transitions API.
    withViewTransition(() => {
      setPhase('designing')
      setErrorText(null)
      setStatusText('reading the room…')
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
          onThinking: () => setThinking(true),
        },
      )
      setGarden(result)
      setFlowers(result.flowers)

      const data = buildGardenData(result)

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
      setThinking(false)
      setStatusText('wrapping it up…')

      const SHORTEN_TIMEOUT_MS = 3000
      const shortId = await Promise.race([
        createShortGarden(data, ctrl.signal),
        new Promise<null>(resolve => setTimeout(() => resolve(null), SHORTEN_TIMEOUT_MS)),
      ])
      if (!shortId) {
        throw new Error("couldn't save your garden. try again?")
      }
      const finalUrl = buildShareUrl(shortId)

      // Add to the on-device "your gardens" archive. Best-effort and
      // fire-and-forget — a storage failure (private mode, quota) never
      // blocks the share flow.
      recordSentGarden(buildMineRecord(shortId, data))
      setMineCount(countSentGardens())

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
      const msg = err instanceof Error ? err.message : 'something went wrong.'
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
      designingRef.current = false
    }
  }, [buildGardenData, canSubmit, from, message, mood, occasion, recipient, remixSeed])

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
    setStatusText('replanting…')
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

      const data = buildGardenData(result)

      const shortId = await createShortGarden(data, ctrl.signal)
      if (!shortId) {
        throw new Error("couldn't save the new garden. try again?")
      }

      // Re-point the archive entry at the regenerated garden — same
      // session, new short ID. Falls back to an insert if the original
      // entry isn't around (storage cleared mid-session).
      updateSentGardenId(prevGardenId, buildMineRecord(shortId, data))

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
      const msg = err instanceof Error ? err.message : 'something went wrong.'
      setErrorText(msg)
      setStatusText('')
      trackGardenError(classifyError(err))
    } finally {
      abortRef.current = null
      setIsRerolling(false)
    }
  }, [
    buildGardenData,
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

    const snapshot: Draft = { from, recipient, message, occasion, mood, scheduleOpen, unlockLocal }

    // Clearing is a quick local action; no view transition needed.
    // React batches these updates automatically in an event handler.
    setFrom('')
    setRecipient('')
    setMessage('')
    setOccasion(DEFAULT_OCCASION)
    setMood(DEFAULT_MOOD)
    // Collapse the schedule picker back to "send now" — a cleared form
    // should look like a fresh one, not leave the time-capsule UI open
    // with a stale (or empty) pick.
    setScheduleOpen(false)
    setUnlockLocal('')
    setUndoDraft(snapshot)

    undoTimerRef.current = setTimeout(() => {
      setUndoDraft(null)
      undoTimerRef.current = null
    }, 8000)
  }, [from, recipient, message, occasion, mood, scheduleOpen, unlockLocal])

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
    setScheduleOpen(undoDraft.scheduleOpen)
    setUnlockLocal(undoDraft.unlockLocal)
    setUndoDraft(null)
  }, [undoDraft])

  // Dismiss the toast early without undoing. The clear stands; we just
  // close the toast and cancel its auto-hide timer so it doesn't fire
  // against an already-dismissed toast.
  const handleDismissUndo = useCallback(() => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
    setUndoDraft(null)
  }, [])

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
      title: 'bloomnote',
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

  // Save the garden as a PNG "share card" (garden + who it's from + wordmark). Rasterized
  // client-side from a self-contained SVG, so it works offline and never leaves the device.
  const handleSaveImage = useCallback(async () => {
    if (!flowers.length || savingImageRef.current) return
    savingImageRef.current = true
    try {
      await saveGardenImage({ flowers, from: from.trim(), to: recipient.trim() })
    } catch {
      // Rare (canvas/decode failure, or a non-abort share error). Swallow so it isn't an unhandled
      // rejection; the Copy-link button remains as the fallback.
    } finally {
      savingImageRef.current = false
    }
  }, [flowers, from, recipient])

  return (
    <div className={styles.wrap}>
      <SoundToggle />
      <header className={styles.header}>
        <p className={styles.kicker}>for someone who matters</p>
        <h1 className={styles.title}>
          <a href="/" aria-label="bloomnote home" style={{ color: 'inherit', textDecoration: 'none' }}>
            bloomnote
          </a>
        </h1>
        <p className={styles.subtitle}>
          {remixSeed
            ? `write ${remixSeed.from || 'them'} back.`
            : 'write a note. they get a whole garden.'}
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

      {/* Onboarding carousel — rendered while the composer is idle on a
          fresh visit (no remix seed). Once the user starts a draft it
          folds away via the `collapsed` prop rather than unmounting, so
          the form glides up instead of snapping. Clearing the draft
          re-expands it. */}
      {phase === 'idle' && !remixSeed && (
        <ExampleCarousel onSelect={handleExampleSelect} collapsed={hasDraft} />
      )}

      {phase === 'idle' && (
        <>
          <div className={styles.nameRow}>
            <section className={styles.section}>
              <label className={styles.label}>from</label>
              <input
                className={styles.input}
                placeholder="your name"
                value={from}
                onChange={e => setFrom(e.target.value)}
                maxLength={60}
              />
            </section>
            <section className={styles.section}>
              <label className={styles.label}>to</label>
              <input
                className={styles.input}
                placeholder="their name"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                maxLength={60}
              />
            </section>
          </div>

          {/* Occasion + mood as chip selectors. Occasion is *when*
              (calendar), mood is *how* (emotional register). Both are
              optional from the user's perspective (mood defaults to "no
              mood") but always sent so the AI gets the full signal.
              Rendered as chips rather than dropdowns so every option is
              visible at a glance and selecting is a single tap. */}
          <section className={styles.section}>
            <span className={styles.label} id="occasion-label">occasion</span>
            <div className={styles.chipRow} role="radiogroup" aria-labelledby="occasion-label">
              {OCCASIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  role="radio"
                  aria-checked={occasion === o.value}
                  className={occasion === o.value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  onClick={() => setOccasion(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </section>
          <section className={styles.section}>
            <span className={styles.label} id="mood-label">mood</span>
            <div className={styles.chipRow} role="radiogroup" aria-labelledby="mood-label">
              {MOODS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mood === m.value}
                  className={mood === m.value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
                  onClick={() => setMood(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </section>

          <section className={styles.section}>
            <label className={styles.label}>your message</label>
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
                quirks beat vibes. the weirder the detail, the better the bouquet.
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

          {errorText && (
            <div className={styles.error} role="alert">
              {errorText}
            </div>
          )}

          <div className={styles.actions}>
            <button
              className={styles.generateBtn}
              onClick={handleDesign}
              disabled={!canSubmit}
            >
              {remixSeed ? 'grow one back' : 'grow their garden'}
            </button>
          </div>

          {/* Tell the user why the button is dead, rather than leaving a
              greyed control they have to puzzle over. See disabledReason. */}
          {disabledReason && (
            <p className={styles.actionHint} aria-live="polite">
              {disabledReason}
            </p>
          )}

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
          <div className={styles.designingRow} role="status" aria-live="polite">
            <Spinner />
            <span>{statusText || 'planting…'}</span>
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
          <button
            type="button"
            className={styles.undoDismiss}
            onClick={handleDismissUndo}
            aria-label="dismiss"
          >
            ×
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

          {message.trim() && (
            <div className={styles.previewMessage}>
              <p className={styles.previewMessageText}>{message.trim()}</p>
              {from.trim() && (
                <p className={styles.previewSig}>— {from.trim()}</p>
              )}
              {/* The AI's bouquet rationale, typed out as a postscript on
                  the note. In the preview it types immediately (start
                  defaults true) — the composer has no bloom gate. */}
              {garden.bouquetNote && <BouquetNote note={garden.bouquetNote} />}
              <p className={styles.previewGrownOn}>
                grown {formatGardenDate(new Date().toISOString())}
              </p>
            </div>
          )}

          <FlowerLegend flowers={garden.flowers} />

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
            onSaveImage={handleSaveImage}
            onReroll={handleReroll}
            onStartOver={handleStartOver}
          />

        </>
      )}

      {/* Attribution + legal live in the shared site Footer (App.tsx). Here we keep only the
          "your gardens" nav link, shown once this device has sent something. When this device
          hasn't sent anything the whole footer is omitted so it doesn't leave an empty padded
          band above the shared site footer. */}
      {mineCount > 0 && (
        <footer className={styles.footer}>
          <p className={styles.footerNav}>
            <a href="/mine">your gardens</a>
          </p>
        </footer>
      )}
    </div>
  )
}

// On-brand loading indicator. Stem grows up, a small leaf unfurls at
// the top, both retract, loops. Way more "bloomnote" than a generic
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

