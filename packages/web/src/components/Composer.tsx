import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BouquetNote from './BouquetNote'
import ChipRow from './ChipRow'
import ExampleCarousel from './ExampleCarousel'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import { SecretEnvelope } from './RecipientView'
import ScheduleInput from './ScheduleInput'
import ShareCard from './ShareCard'
import SoundToggle from './SoundToggle'
import { type ExampleGarden } from '../data/exampleGardens'
import { buildShareUrl, createShortGarden, type FlowerSpec, type GardenData } from '../garden'
import {
  trackComposerOpened,
  trackGardenCanceled,
  trackGardenError,
  trackGardenGenerated,
  trackGardenRerolled,
  trackMakeAnother,
} from '../lib/analytics'
import { designGarden, type DesignResult } from '../lib/designGarden'
import { prefersReducedMotion } from '../lib/motion'
import { prewarmGardenImage, uploadOgImage } from '../lib/gardenImage'
import { formatGardenDate } from '../lib/formatDate'
import { gardenForecast } from '../lib/gardenForecast'
import { countSentGardens, recordSentGarden, updateSentGardenId } from '../lib/mine'
import { MOODS } from '../lib/moods'
import { OCCASIONS } from '../lib/occasions'
import { placeholderFor, placeholderOptions } from '../lib/placeholders'
import { ritual } from '../lib/rituals'
import { withViewTransition } from '../lib/viewTransition'
import { playSuccess, playWhoosh } from '../sound'
import styles from './Composer.module.css'
import {
  buildMineRecord,
  charCountTierClass,
  classifyError,
  disabledReasonFor,
  scheduleErrorFor,
} from '../lib/composerHelpers'
import { useComposerDraft } from '../lib/useComposerDraft'
import { useHeroDemo } from '../lib/useHeroDemo'
import { useShareActions } from '../lib/useShareActions'

type Phase = 'idle' | 'designing' | 'designed'

const THINKING_MESSAGES = [
  'reading between the lines…',
  'choosing flowers…',
  'mixing the palette…',
  'arranging the bouquet…',
  'writing the note…',
]

interface ComposerProps {
  remixSeed?: GardenData | undefined
}

export default function Composer({ remixSeed }: ComposerProps = {}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const draft = useComposerDraft({ remixSeed, idle: phase === 'idle' })
  const { from, recipient, message, secret, occasion, mood, scheduleOpen, unlockLocal } = draft.fields
  const {
    from: setFrom,
    recipient: setRecipient,
    message: setMessage,
    secret: setSecret,
    occasion: setOccasion,
    mood: setMood,
    scheduleOpen: setScheduleOpen,
    unlockLocal: setUnlockLocal,
  } = draft.set
  const { hasDraft, undoDraft } = draft
  const clearStoredDraft = draft.forget

  // Keyed on occasion only. Re-reading the clock every render would change the copy under
  // somebody who happens to be writing at 11:59.
  const [ritualAt] = useState(() => new Date())
  const todaysRitual = useMemo(() => ritual(occasion, ritualAt), [occasion, ritualAt])
  const placeholder = placeholderFor(occasion, mood)
  const promptOptions = useMemo(() => placeholderOptions(occasion, mood), [occasion, mood])
  const [promptIndex, setPromptIndex] = useState(0)
  const writingPrompt = promptOptions[promptIndex % promptOptions.length] ?? placeholder
  useEffect(() => setPromptIndex(0), [occasion, mood])

  const [mineCount, setMineCount] = useState(() => countSentGardens())

  const [statusText, setStatusText] = useState<string>('')
  const [thinking, setThinking] = useState(false)
  const [errorText, setErrorText] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // The button doesn't unmount until the view transition swaps the DOM, so without this a
  // fast second tap runs designGarden twice.
  const designingRef = useRef(false)

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

  useEffect(() => {
    if (phase !== 'designing') setThinking(false)
  }, [phase])

  const [rerollAttempt, setRerollAttempt] = useState(0)
  const [isRerolling, setIsRerolling] = useState(false)

  const [garden, setGarden] = useState<DesignResult | null>(null)
  const [flowers, setFlowers] = useState<FlowerSpec[]>([])
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [gardenId, setGardenId] = useState<string | null>(null)
  const [previewSecretRevealed, setPreviewSecretRevealed] = useState(false)

  useEffect(() => setPreviewSecretRevealed(false), [gardenId, garden?.flowers])

  const messageRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (remixSeed && messageRef.current) {
      messageRef.current.focus()
    }
  }, [remixSeed])

  // iOS Safari slides the keyboard over the field the user just tapped, and its own
  // scroll-on-focus is unreliable. Wait out the slide animation before scrolling, or the
  // browser measures the old viewport height.
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

  useEffect(() => {
    trackComposerOpened(remixSeed ? 'remix' : 'fresh')
  }, [remixSeed])

  const scheduleError = scheduleErrorFor(scheduleOpen, unlockLocal)
  const disabledReason = disabledReasonFor({
    recipient,
    message,
    scheduleOpen,
    unlockLocal,
    scheduleError,
  })

  /* Start the PNG now: the tap that shares it must not wait on a render. */
  useEffect(() => {
    if (phase !== 'designed' || flowers.length === 0) return
    prewarmGardenImage({ flowers, from: from.trim(), to: recipient.trim() })
  }, [phase, flowers, from, recipient])

  const canSubmit = disabledReason === null
  const forecast = useMemo(() => gardenForecast(message, mood, occasion), [message, mood, occasion])

  const buildGardenData = useCallback(
    (result: DesignResult): GardenData => {
      // Clamp a time that has already passed, or the capsule ships already unlocked. The
      // 30-second grace matches the server.
      let unlockAt: string | undefined
      if (scheduleOpen && unlockLocal) {
        const t = new Date(unlockLocal).getTime()
        if (Number.isFinite(t) && t > Date.now() + 30_000) {
          unlockAt = new Date(t).toISOString()
        }
      }
      // Cap reply depth at 1. The recipient view only renders one level back, and without the
      // strip a long thread nests a garden per reply.
      const seedForPrevious = remixSeed ? { ...remixSeed, previous: undefined } : undefined
      return {
        flowers: result.flowers,
        bouquetNote: result.bouquetNote,
        message: message.trim(),
        ...(secret.trim() ? { secret: secret.trim() } : {}),
        from: from.trim(),
        to: recipient.trim(),
        createdAt: new Date().toISOString(),
        unlockAt,
        occasion,
        mood,
        previous: seedForPrevious,
      }
    },
    [scheduleOpen, unlockLocal, remixSeed, message, secret, from, recipient, occasion, mood],
  )

  const handleDesign = useCallback(async () => {
    if (!canSubmit || designingRef.current) return
    designingRef.current = true
    setRerollAttempt(0)
    withViewTransition(() => {
      setPhase('designing')
      setErrorText(null)
      setStatusText('reading the room…')
    })

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const startedAt = performance.now()

    try {
      playWhoosh()
      const result = await designGarden(
        {
          message: message.trim(),
          recipient: recipient.trim(),
          from: from.trim() || undefined,
          occasion,
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

      // Don't fall back to a self-contained URL here. It costs the user the garden they waited
      // five seconds for, but a share link that silently half-works is worse.
      setThinking(false)
      setStatusText('wrapping it up…')

      const SHORTEN_TIMEOUT_MS = 3000
      const shortId = await Promise.race([
        createShortGarden(data, ctrl.signal),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SHORTEN_TIMEOUT_MS)),
      ])
      if (!shortId) {
        throw new Error("couldn't save your garden. try again?")
      }
      const finalUrl = buildShareUrl(shortId)

      clearStoredDraft()

      /* Not awaited. It costs a canvas rasterize and a round trip, and nobody should wait on the
         link preview to get their link. */
      void uploadOgImage(shortId, { flowers: result.flowers, from: from.trim(), to: recipient.trim() })

      recordSentGarden(buildMineRecord(shortId, data))
      setMineCount(countSentGardens())

      playSuccess()
      withViewTransition(() => {
        setShareUrl(finalUrl)
        setGardenId(shortId)
        setStatusText('')
        setPhase('designed')
      })

      // Structural metadata only. Never the note text or the names.
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
      // Bucket by error shape. Raw model error text can carry pieces of the user's note.
      trackGardenError(classifyError(err))
    } finally {
      abortRef.current = null
      designingRef.current = false
    }
  }, [buildGardenData, canSubmit, from, message, mood, occasion, recipient, remixSeed, clearStoredDraft])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleReroll = useCallback(async () => {
    if (isRerolling) return
    const prevGarden = garden
    const prevFlowers = flowers
    const prevShareUrl = shareUrl
    const prevGardenId = gardenId

    setIsRerolling(true)
    setStatusText('regrowing…')
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

      void uploadOgImage(shortId, { flowers: result.flowers, from: from.trim(), to: recipient.trim() })

      updateSentGardenId(prevGardenId, buildMineRecord(shortId, data))

      // No extra orchestration: GardenScene re-keys on the flower signature, so the new flowers
      // re-bloom from sprout on their own.
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
        setGarden(prevGarden)
        setFlowers(prevFlowers)
        setShareUrl(prevShareUrl)
        setGardenId(prevGardenId)
        setStatusText('')
        return
      }
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
    clearStoredDraft()
    withViewTransition(() => {
      setPhase('idle')
      setGarden(null)
      setFlowers([])
      setShareUrl(null)
      setGardenId(null)
      setErrorText(null)
      draft.reset()
      setRerollAttempt(0)
    })
    trackMakeAnother()
  }, [clearStoredDraft, draft])

  const showDemo = phase === 'idle' && !remixSeed && !hasDraft && flowers.length === 0
  const hero = useHeroDemo({
    showDemo,
    flowers,
    occasion,
    mood,
    message,
    gardenSignature: garden ? garden.flowers.map((f) => f.name).join('-') : null,
  })

  const handleExampleSelect = useCallback(
    (g: ExampleGarden) => {
      draft.applyExample({
        from: g.from,
        recipient: g.to,
        message: g.message,
        occasion: g.occasion,
        mood: g.mood,
      })
      // Next tick: some browsers refuse focus on an element that is mid-controlled-update.
      setTimeout(() => {
        messageRef.current?.focus()
        const t = messageRef.current
        if (t) t.setSelectionRange(t.value.length, t.value.length)
      }, 0)
    },
    [draft],
  )

  const handleClear = draft.clear
  const handleUndoClear = draft.undoClear
  const handleDismissUndo = draft.dismissUndo

  const { copied, shareStatus, imageStatus, canShare, handleCopy, handleShare, handleSaveImage } =
    useShareActions(shareUrl, recipient, from, flowers)

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
          {phase === 'designed'
            ? recipient.trim()
              ? `it's ${recipient.trim()}'s now. send it when you're ready.`
              : "it's theirs now. send it when you're ready."
            : remixSeed
              ? `write ${remixSeed.from || 'them'} back.`
              : 'write a note. they get a whole garden.'}
        </p>
      </header>
      {draft.showRecovered && (
        <p className={styles.recoveredDraft} role="status">
          Your draft is still here.
        </p>
      )}

      <GardenScene
        flowers={hero.flowers}
        autoBloom
        occasion={hero.occasion}
        mood={hero.mood}
        silent={showDemo}
        sprouting={phase === 'designing'}
        compact={hasDraft}
        draftGrowth={hero.draftGrowth}
        key={hero.sceneKey}
      />

      {phase === 'idle' && remixSeed && (
        <RemixContext
          previous={remixSeed}
          label={remixSeed.from ? `replying to ${remixSeed.from}` : 'replying'}
        />
      )}

      {phase === 'idle' && (
        <>
          <section className={styles.section}>
            {/* htmlFor and id, not adjacency. Every label on this form sits beside its input rather
                than wrapping it, so without the pairing each field's only name is its placeholder. */}
            <label className={styles.label} htmlFor="note">
              your note
            </label>
            <p className={styles.ritual}>
              {todaysRitual.invitation}
              {todaysRitual.permission && <span>{todaysRitual.permission}</span>}
            </p>
            <textarea
              id="note"
              ref={messageRef}
              className={styles.textarea}
              placeholder={writingPrompt}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={400}
            />
            <div className={styles.helperRow}>
              <span className={styles.helper}>
                quirks beat vibes. the weirder the detail, the better the bouquet.
              </span>
              <span className={`${styles.charCount} ${charCountTierClass(message.length, styles)}`}>
                {message.length}/400
              </span>
            </div>
            {!message.trim() && (
              <div className={styles.promptRow}>
                <button
                  type="button"
                  className={styles.promptLink}
                  onClick={() => {
                    setMessage(writingPrompt)
                    messageRef.current?.focus()
                  }}
                >
                  use this thought
                </button>
                {promptOptions.length > 1 && (
                  <button
                    type="button"
                    className={styles.promptLink}
                    onClick={() => setPromptIndex((index) => index + 1)}
                  >
                    another angle ↻
                  </button>
                )}
              </div>
            )}
          </section>

          {!remixSeed && (
            <ExampleCarousel
              onSelect={handleExampleSelect}
              collapsed={hasDraft}
              activeId={hero.activeId}
              onPreview={hero.preview}
            />
          )}

          <div className={styles.nameRow}>
            <section className={styles.section}>
              <label className={styles.label} htmlFor="garden-from">
                from
              </label>
              <input
                id="garden-from"
                className={styles.input}
                placeholder="your name"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                maxLength={60}
              />
            </section>
            <section className={styles.section}>
              <label className={styles.label} htmlFor="garden-to">
                to
              </label>
              <input
                id="garden-to"
                className={styles.input}
                placeholder="their name"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                maxLength={60}
              />
            </section>
          </div>

          <details className={styles.secretNote} open={secret.length > 0 ? true : undefined}>
            <summary>add a tiny secret</summary>
            <div className={styles.secretNoteField}>
              <label htmlFor="secret-note">a little aside they can tap to reveal</label>
              <textarea
                id="secret-note"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="p.s. I still have that ridiculous photo of us."
                rows={2}
                maxLength={140}
              />
              <span>{secret.length}/140</span>
            </div>
          </details>

          <section className={styles.section}>
            <span className={styles.label} id="occasion-label">
              occasion
            </span>
            <ChipRow labelledBy="occasion-label">
              {OCCASIONS.map((o) => (
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
            </ChipRow>
          </section>
          <section className={styles.section}>
            <span className={styles.label} id="mood-label">
              mood
            </span>
            <ChipRow labelledBy="mood-label">
              {MOODS.map((m) => (
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
            </ChipRow>
          </section>

          {message.trim().length >= 4 && (
            <section className={styles.forecast} aria-label="Garden forecast" aria-live="polite">
              <div className={styles.forecastHead}>
                <span>
                  <span className={styles.forecastEyebrow}>garden forecast</span>
                  <strong>{forecast.tone}</strong>
                </span>
                <span className={styles.forecastSwatches} aria-label={forecast.palette}>
                  {forecast.colors.map((color) => (
                    <i key={color} style={{ backgroundColor: color }} />
                  ))}
                </span>
              </div>
              <p>
                likely {forecast.shape} in {forecast.palette}, under {forecast.light}.
              </p>
              <div className={styles.forecastSoil}>
                <span className={styles.forecastDots} aria-hidden>
                  {[1, 2, 3].map((level) => (
                    <i key={level} data-grown={level <= forecast.detailLevel} />
                  ))}
                </span>
                <span>{forecast.detailCopy}</span>
              </div>
              <small>direction only. the final garden still gets to surprise you.</small>
            </section>
          )}

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
            <button className={styles.generateBtn} onClick={handleDesign} disabled={!canSubmit}>
              {remixSeed ? 'grow one back' : 'grow their garden'}
            </button>
          </div>

          {disabledReason && (
            <p className={styles.actionHint} aria-live="polite">
              {disabledReason}
            </p>
          )}

          {remixSeed && (
            <p className={styles.escape}>
              <a href="/">or start fresh</a>
            </p>
          )}

          {!remixSeed && hasDraft && (
            <p className={styles.escape}>
              <button type="button" className={styles.clearBtn} onClick={handleClear}>
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
            <span>{statusText || 'growing…'}</span>
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

      {phase === 'designed' && garden && <PetalFall key={gardenId ?? 'fall'} flowers={garden.flowers} />}

      {phase === 'designed' && garden && shareUrl && (
        <>
          <p className={styles.previewLabel}>
            {recipient.trim() ? `what ${recipient.trim()} sees` : 'what they see'}
          </p>

          <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={styles.fullRevealPreview}>
            <span aria-hidden>◌</span>
            preview the full reveal
            <span aria-hidden>↗</span>
          </a>

          <p className={styles.previewSenderLine}>
            {from.trim() ? (
              <>
                <span className={styles.previewFromName}>{from.trim()}</span>
                {' grew '}
                {recipient.trim() || 'them'}
                {' a garden'}
              </>
            ) : (
              `someone grew ${recipient.trim() || 'them'} a garden`
            )}
          </p>

          {message.trim() && (
            <div className={styles.previewMessage}>
              <p className={styles.previewMessageText}>{message.trim()}</p>
              {from.trim() && <p className={styles.previewSig}>— {from.trim()}</p>}
              {garden.bouquetNote && <BouquetNote note={garden.bouquetNote} />}
              {secret.trim() && (
                <div className={styles.previewSecret}>
                  <button
                    type="button"
                    className={styles.previewSecretReveal}
                    onClick={() => setPreviewSecretRevealed((revealed) => !revealed)}
                    aria-expanded={previewSecretRevealed}
                  >
                    <SecretEnvelope open={previewSecretRevealed} />
                    {previewSecretRevealed ? 'hide the little secret' : 'there’s a little secret in here'}
                  </button>
                  {previewSecretRevealed && <p className={styles.previewSecretText}>{secret.trim()}</p>}
                </div>
              )}
              <p className={styles.previewGrownOn}>grown {formatGardenDate(new Date().toISOString())}</p>
            </div>
          )}

          <FlowerLegend flowers={garden.flowers} />

          <hr className={styles.shareDivider} aria-hidden />

          <ShareCard
            shareUrl={shareUrl}
            gardenId={gardenId}
            recipient={recipient}
            copied={copied}
            shareStatus={shareStatus}
            imageStatus={imageStatus}
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
        <path d="M 10 14 Q 17 9, 14 16 Q 11 15, 10 14" fill="currentColor" className={styles.sproutLeaf} />
      </svg>
    </span>
  )
}

/* Don't merge this with the plot's ambient drift. That one loops forever and belongs to the
   scene; this one falls once, when a garden is finished. */
const FALL_MS = 4200

function PetalFall({ flowers }: { flowers: FlowerSpec[] }) {
  const [done, setDone] = useState(prefersReducedMotion())

  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setTimeout(() => setDone(true), FALL_MS)
    return () => clearTimeout(t)
  }, [])

  // Unmounted, not left at opacity 0: eighteen absolutely-positioned nodes should not outlive
  // the four seconds they are visible for.
  if (done || flowers.length === 0) return null

  return (
    <div className={styles.petalFall} aria-hidden>
      {PETAL_FALL.map(([left, size, delay, duration, drift, rotate], i) => {
        const flower = flowers[i % flowers.length]!
        return (
          <span
            key={i}
            className={styles.fallPetal}
            style={{
              ['--left' as string]: `${left}%`,
              ['--size' as string]: `${size}px`,
              ['--delay' as string]: `${delay}ms`,
              ['--duration' as string]: `${duration}ms`,
              ['--drift' as string]: `${drift}px`,
              ['--rotate' as string]: `${rotate}deg`,
              ['--color' as string]: flower.petalColors[i % flower.petalColors.length]!,
            }}
          />
        )
      })}
    </div>
  )
}

/* left %, size px, delay ms, duration ms, drift px, start rotation deg.
   Hand-placed rather than random so the spread stays uneven without clumping. */
// prettier-ignore
const PETAL_FALL: Array<[number, number, number, number, number, number]> = [
  [6, 10, 0, 3000, 42, 12], [18, 7, 320, 3400, -28, 200], [29, 11, 120, 2700, 60, 74],
  [41, 8, 560, 3200, -46, 310], [52, 9, 240, 3050, 34, 140], [63, 6, 700, 3500, -22, 20],
  [74, 10, 90, 2850, 52, 250], [86, 8, 430, 3300, -38, 96], [94, 7, 620, 3100, 26, 175],
  [12, 8, 880, 2900, -34, 58], [35, 6, 1010, 3250, 44, 290], [58, 10, 760, 2950, -50, 130],
  [80, 7, 1120, 3150, 30, 218], [24, 9, 1240, 3050, -40, 66],
]
