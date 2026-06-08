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
import { loadDraft, saveDraft } from '../lib/draft'
import { DEFAULT_OCCASION, OCCASIONS, OCCASION_VALUES } from '../lib/occasions'
import { shortenUrl } from '../lib/shorten'
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
  const [progress, setProgress] = useState<number>(0)
  const [statusText, setStatusText] = useState<string>('')
  const [errorText, setErrorText] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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
    setPhase('designing')
    setErrorText(null)
    setProgress(0)
    setStatusText('Reading your note…')

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
          onThinking: () => setStatusText('Thinking about who they are…'),
          onProgress: count => {
            setProgress(count)
            if (count === 0) setStatusText('Sketching the first flower…')
            else if (count === 1) setStatusText('Picking the next palette…')
            else setStatusText(`Designed ${count} flower${count === 1 ? '' : 's'}…`)
          },
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
      setStatusText('Shortening link…')

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

      setShareUrl(finalUrl)
      setStatusText('')
      setPhase('designed')
      playSuccess()
    } catch (err) {
      if (ctrl.signal.aborted) {
        setPhase('idle')
        return
      }
      const msg = err instanceof Error ? err.message : 'Something went wrong.'
      setErrorText(msg)
      setPhase('idle')
    } finally {
      abortRef.current = null
    }
  }, [canSubmit, from, message, recipient, remixSeed])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleStartOver = useCallback(() => {
    setPhase('idle')
    setGarden(null)
    setFlowers([])
    setShareUrl(null)
    setProgress(0)
    setErrorText(null)
    // Inputs are intentionally NOT cleared on "Make another" — if you
    // want a totally fresh note you can edit them; if you want to tweak
    // and regenerate, your text is still there.
  }, [])

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
            ? `Write ${remixSeed.from || 'them'} back. Their note grows them a garden.`
            : 'Write someone a note. We grow them a garden from it.'}
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
          label={remixSeed.from ? `Replying to ${remixSeed.from}` : 'Replying'}
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
                Be specific — a memory, a quirk, what they mean to you. The garden is designed from this.
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
              {remixSeed ? 'Grow them one back' : 'Grow their garden'}
            </button>
          </div>

          {remixSeed && (
            <p className={styles.escape}>
              <a href={window.location.origin + window.location.pathname}>
                Start fresh instead
              </a>
            </p>
          )}
        </>
      )}

      {phase === 'designing' && (
        <div className={styles.designingPanel}>
          <div className={styles.designingRow}>
            <Spinner />
            <span>{statusText || 'Designing…'}</span>
          </div>
          <ProgressDots count={progress} total={5} />
          <button className={styles.cancelBtn} onClick={handleCancel}>
            Cancel
          </button>
        </div>
      )}

      {phase === 'designed' && garden && shareUrl && (
        <>
          {garden.bouquetNote && (
            <div className={styles.bouquetNote}>
              <span className={styles.bouquetNoteLabel}>Note</span>
              <p>{garden.bouquetNote}</p>
            </div>
          )}

          <FlowerLegend flowers={garden.flowers} />

          <div className={styles.shareCard}>
            <p className={styles.shareTitle}>
              {recipient ? `${recipient}'s garden is ready` : 'Their garden is ready'}
            </p>
            <div className={styles.urlBox}>
              <span className={styles.urlText}>{shareUrl}</span>
            </div>
            <div className={styles.shareActions}>
              {canShare && (
                <button className={styles.shareBtn} onClick={handleShare}>
                  Share…
                </button>
              )}
              <button
                className={canShare ? styles.copyBtnSecondary : styles.copyBtn}
                onClick={handleCopy}
              >
                {copied ? 'Copied!' : 'Copy link'}
              </button>
              <button className={styles.resetBtn} onClick={handleStartOver}>
                Make another
              </button>
            </div>
          </div>

        </>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <span className={styles.spinner} aria-hidden>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.2" />
        <path d="M9 2 A7 7 0 0 1 16 9" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  )
}

function ProgressDots({ count, total }: { count: number; total: number }) {
  return (
    <div className={styles.progressDots} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={`${styles.progressDot} ${i < count ? styles.progressDotActive : ''}`}
        />
      ))}
    </div>
  )
}
