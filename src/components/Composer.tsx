import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import {
  buildShareUrl,
  decodeGarden,
  type FlowerSpec,
  type GardenData,
} from '../garden'
import { designGarden, type DesignResult } from '../lib/designGarden'
import { clearDraft, loadDraft, saveDraft, type Draft } from '../lib/draft'
import { formatGardenDate } from '../lib/formatDate'
import { DEFAULT_OCCASION, OCCASIONS, OCCASION_VALUES } from '../lib/occasions'
import { shortenUrl } from '../lib/shorten'
import { withViewTransition } from '../lib/viewTransition'
import { playSuccess, playWhoosh } from '../sound'
import styles from './Composer.module.css'

// Two phases instead of four. The message is the input; the garden +
// share link are the output. No second-phase "now add a message" step,
// because the message is already there.
type Phase = 'idle' | 'designing' | 'designed'

const MESSAGE_PLACEHOLDERS = [
  "Happy birthday, Maya. You're the only person I know who keeps a tide journal AND laughs too loudly at her own jokes. You'd drive six hours to see a sunset and somehow always rope me in. So glad you exist.",
  "Mom — 60 years. You raised three kids on your own while finishing your degree at night, taught me how to garden, and still call every Sunday. I don't say thank you enough.",
  "Theo — the night I was applying to grad school, you stayed up making sure I ate. The pour-over was the best part. I think about that a lot. Happy birthday, friend.",
]

/**
 * Read the `?remix=...` URL param once at mount and decode it. Returns
 * null if missing or malformed — Composer treats that as "fresh
 * composition."
 */
function readRemixSeed(): GardenData | null {
  const params = new URLSearchParams(window.location.search)
  const encoded = params.get('remix')
  if (!encoded) return null
  return decodeGarden(encoded)
}

export default function Composer() {
  // Read the remix seed exactly once at mount. We intentionally use
  // useMemo (not useState) because the seed should never change during
  // a single Composer lifetime — switching threads requires a full
  // navigation.
  const remixSeed = useMemo(readRemixSeed, [])

  const [phase, setPhase] = useState<Phase>('idle')

  // Initial input values are computed once at mount. Precedence:
  //   1. Remix seed (URL-driven, most authoritative — we're answering
  //      a specific person)
  //   2. localStorage draft (the user's in-progress work from last
  //      visit)
  //   3. Empty
  // The message field never inherits from the seed; only From/To do.
  // In remix mode the draft is ignored entirely so a stale draft about
  // a different recipient doesn't bleed into the reply.
  const initialInputs = useMemo(() => {
    if (remixSeed) {
      return {
        from: remixSeed.to ?? '',
        recipient: remixSeed.from ?? '',
        message: '',
        // Reset occasion per remix — replies are new conversations,
        // not continuations of an occasion.
        occasion: DEFAULT_OCCASION,
      }
    }
    const draft = loadDraft()
    return {
      from: draft?.from ?? '',
      recipient: draft?.recipient ?? '',
      message: draft?.message ?? '',
      // Honor a saved occasion only if it's still a known value;
      // otherwise default. Defends against future renamings.
      occasion: draft?.occasion && OCCASION_VALUES.has(draft.occasion)
        ? draft.occasion
        : DEFAULT_OCCASION,
    }
  }, [remixSeed])

  const [from, setFrom] = useState(initialInputs.from)
  const [recipient, setRecipient] = useState(initialInputs.recipient)
  const [message, setMessage] = useState(initialInputs.message)
  const [occasion, setOccasion] = useState(initialInputs.occasion)

  // Autosave on every change. localStorage writes are sync but fast for
  // strings this small; no debounce needed. Skipped in remix mode (see
  // comment on `initialInputs` above).
  useEffect(() => {
    if (remixSeed) return
    saveDraft({ from, recipient, message, occasion })
  }, [from, recipient, message, occasion, remixSeed])
  const [placeholder] = useState(
    () => MESSAGE_PLACEHOLDERS[Math.floor(Math.random() * MESSAGE_PLACEHOLDERS.length)],
  )

  // Streaming progress.
  const [statusText, setStatusText] = useState<string>('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  const canSubmit = recipient.trim().length >= 1 && message.trim().length >= 4

  const handleDesign = useCallback(async () => {
    if (!canSubmit) return
    // Cross-fade form → designing panel via View Transitions API.
    withViewTransition(() => {
      setPhase('designing')
      setErrorText(null)
      setStatusText('reading…')
    })

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      playWhoosh()
      const result = await designGarden(
        {
          message: message.trim(),
          recipient: recipient.trim(),
          from: from.trim() || undefined,
          occasion,
        },
        {
          signal: ctrl.signal,
          onThinking: () => setStatusText('thinking…'),
        },
      )
      setGarden(result)
      setFlowers(result.flowers)

      // The share URL bundles the new garden AND (if this is a reply)
      // the original garden as `previous`. The depth cap in
      // encodeGarden means we never accumulate more than one round of
      // history in the URL.
      const data: GardenData = {
        flowers: result.flowers,
        bouquetNote: result.bouquetNote,
        message: message.trim(),
        from: from.trim(),
        to: recipient.trim(),
        // Stamp when the sender hit "Grow their garden" — shows up
        // on the recipient's view as a card-like "Grown {date}" line.
        createdAt: new Date().toISOString(),
        previous: remixSeed ?? undefined,
      }
      const longUrl = buildShareUrl(data)

      // We stay in 'designing' phase until the shortener resolves (or
      // times out). The cost is ~1 extra second on the perceived
      // design latency; the win is that the user never sees the long
      // URL flash on screen and then change. We cap the shortener wait
      // at 3 seconds — past that, we go with the long URL rather than
      // hanging the share UI on a flaky third-party.
      setStatusText('shortening link…')

      const SHORTEN_TIMEOUT_MS = 3000
      let finalUrl = longUrl
      try {
        const result = await Promise.race([
          shortenUrl(longUrl, ctrl.signal),
          new Promise<null>(resolve => setTimeout(() => resolve(null), SHORTEN_TIMEOUT_MS)),
        ])
        if (typeof result === 'string') finalUrl = result
      } catch {
        // Shortener failed — fall back to long URL.
      }

      // Cross-fade designing panel → designed preview. playSuccess
      // stays outside the transition so the chime plays at the start
      // of the visual change, not after it.
      playSuccess()
      withViewTransition(() => {
        setShareUrl(finalUrl)
        setStatusText('')
        setPhase('designed')
      })
    } catch (err) {
      if (ctrl.signal.aborted) {
        withViewTransition(() => setPhase('idle'))
        return
      }
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      withViewTransition(() => {
        setErrorText(msg)
        setPhase('idle')
      })
    } finally {
      abortRef.current = null
    }
  }, [canSubmit, from, message, recipient, remixSeed])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleStartOver = useCallback(() => {
    // Cross-fade designed view → fresh idle form.
    withViewTransition(() => {
      setPhase('idle')
      setGarden(null)
      setFlowers([])
      setShareUrl(null)
      setErrorText(null)
    })
    // Inputs are intentionally NOT cleared on "Make another" — if you
    // want a totally fresh note you can edit them; if you want to tweak
    // and regenerate, your text is still there.
  }, [])

  // Only show the clear link when there's something to clear. Trimmed
  // so "  " in a field doesn't count as draft content.
  const hasDraft =
    from.trim().length > 0 || recipient.trim().length > 0 || message.trim().length > 0

  const handleClear = useCallback(() => {
    // Snapshot before wiping so undo works. If a previous undo was
    // pending, cancel its timer — the new clear takes precedence.
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current)

    const snapshot: Draft = { from, recipient, message, occasion }

    // Clearing is a quick local action; no view transition needed.
    // React batches these updates automatically in an event handler.
    setFrom('')
    setRecipient('')
    setMessage('')
    setOccasion(DEFAULT_OCCASION)
    setUndoDraft(snapshot)
    clearDraft()

    undoTimerRef.current = setTimeout(() => {
      setUndoDraft(null)
      undoTimerRef.current = null
    }, 8000)
  }, [from, recipient, message, occasion])

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
    setUndoDraft(null)
  }, [undoDraft])

  const handleCopy = useCallback(() => {
    if (!shareUrl) return
    void navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
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
              <span className={styles.charCount}>{message.length}/400</span>
            </div>
          </section>

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
              <a href={window.location.origin + window.location.pathname}>
                or start fresh
              </a>
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

          {garden.bouquetNote && (
            <div className={styles.bouquetNote}>
              <span className={styles.bouquetNoteLabel}>note</span>
              <p>{garden.bouquetNote}</p>
            </div>
          )}

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

          <FlowerLegend flowers={garden.flowers} />

          {/* Divider separating "what they'll see" from "how you share it." */}
          <hr className={styles.shareDivider} aria-hidden />

          <div className={styles.shareCard}>
            <p className={styles.shareTitle}>
              {recipient ? `${recipient}'s garden is ready` : 'ready to send'}
            </p>
            <div className={styles.urlBox}>
              <span className={styles.urlText}>{shareUrl}</span>
            </div>
            <div className={styles.shareActions}>
              {canShare && (
                <button className={styles.shareBtn} onClick={handleShare}>
                  share
                </button>
              )}
              <button
                className={canShare ? styles.copyBtnSecondary : styles.copyBtn}
                onClick={handleCopy}
              >
                {copied ? 'copied' : 'copy link'}
              </button>
              <button className={styles.resetBtn} onClick={handleStartOver}>
                make another
              </button>
            </div>
          </div>

        </>
      )}

      {/* Footer block — privacy disclosure + author credit. The
          privacy line is the honest thing to say given that (a) the
          user's note is processed by a third-party model and (b) the
          full note ends up inside the share URL, where anyone holding
          the link can read it. Direct, lowercase, no legalese — same
          register as the rest of the UI copy. */}
      <div className={styles.footer}>
        <p className={styles.disclosure}>
          your note is sent to gemini and encoded in the share link.
        </p>
        {/* TODO: swap the href below for your portfolio URL once it's
            live (e.g. https://aidenjang.com). Keeping `#` as a
            deliberate placeholder so it doesn't 404 on a guessed
            GitHub handle in the meantime. */}
        <p className={styles.credit}>
          made by{' '}
          <a href="#" target="_blank" rel="noreferrer">
            aiden jang
          </a>
        </p>
      </div>
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

