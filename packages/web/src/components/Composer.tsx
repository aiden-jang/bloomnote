import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChipPicker from './ChipPicker'
import ComposerPreview from './ComposerPreview'
import NoteField from './NoteField'
import GardenForecastPanel from './GardenForecastPanel'
import ExampleCarousel from './ExampleCarousel'
import GardenScene from './GardenScene'
import RemixContext from './RemixContext'
import ScheduleInput from './ScheduleInput'
import ShareCard from './ShareCard'
import ComposerFrame from './ComposerFrame'
import { type ExampleGarden } from '../data/exampleGardens'
import { type GardenData } from '../garden'
import { trackComposerOpened } from '../lib/analytics'
import { useGardenDesign } from '../lib/useGardenDesign'
import { countSentGardens } from '../lib/mine'
import { PetalFall } from './ComposerBloom'
import GrowFeedback from './GrowFeedback'
import { prewarmGardenImage } from '../lib/gardenImage'
import { gardenForecast } from '../lib/gardenForecast'
import { MOODS } from '../lib/moods'
import { OCCASIONS } from '../lib/occasions'
import { placeholderFor, placeholderOptions } from '../lib/placeholders'
import { ritual } from '../lib/rituals'
import { prefersReducedMotion } from '../lib/motion'
import styles from './Composer.module.css'
import { disabledReasonFor, scheduleErrorFor } from '../lib/composerHelpers'
import { useComposerDraft } from '../lib/useComposerDraft'
import { useHeroDemo } from '../lib/useHeroDemo'
import { useShareActions } from '../lib/useShareActions'

interface ComposerProps {
  remixSeed?: GardenData | undefined
}

export default function Composer({ remixSeed }: ComposerProps = {}) {
  const design = useGardenDesign(remixSeed)
  const { phase, statusText, errorText, garden, flowers, shareUrl, gardenId, isRerolling } = design

  const [mineCount, setMineCount] = useState(() => countSentGardens())
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

  // Keyed on occasion only. Re-reading the clock every render would change the copy under
  // somebody who happens to be writing at 11:59.
  const [ritualAt] = useState(() => new Date())
  const todaysRitual = useMemo(() => ritual(occasion, ritualAt), [occasion, ritualAt])
  const placeholder = placeholderFor(occasion, mood)
  const promptOptions = useMemo(() => placeholderOptions(occasion, mood), [occasion, mood])
  const [promptIndex, setPromptIndex] = useState(0)
  const writingPrompt = promptOptions[promptIndex % promptOptions.length] ?? placeholder
  useEffect(() => setPromptIndex(0), [occasion, mood])

  const messageRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (
      (remixSeed || new URLSearchParams(window.location.search).get('write') === '1') &&
      messageRef.current
    ) {
      messageRef.current.focus()
    }
  }, [remixSeed])

  // iOS Safari slides the keyboard over the field the user just tapped, and its own
  // scroll-on-focus is unreliable. Wait out the slide animation before scrolling, or the
  // browser measures the old viewport height.
  useEffect(() => {
    const ta = messageRef.current
    if (!ta) return
    let timer: number | undefined
    const cancel = () => window.clearTimeout(timer)
    const onFocus = () => {
      cancel()
      timer = window.setTimeout(() => {
        if (document.activeElement !== ta) return
        ta.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      }, 300)
    }
    ta.addEventListener('focus', onFocus)
    ta.addEventListener('blur', cancel)
    return () => {
      cancel()
      ta.removeEventListener('focus', onFocus)
      ta.removeEventListener('blur', cancel)
    }
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

  const runDesign = useCallback(() => {
    if (!canSubmit) return
    void design.start(draft.fields, () => {
      draft.forget()
      setMineCount(countSentGardens())
    })
  }, [canSubmit, design, draft])

  const handleStartOver = useCallback(() => {
    draft.forget()
    design.startOver(draft.reset)
  }, [design, draft])
  const forecast = useMemo(() => gardenForecast(message, mood, occasion), [message, mood, occasion])

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

  const { copied, shareStatus, imageStatus, canShare, shareError, handleCopy, handleShare, handleSaveImage } =
    useShareActions(shareUrl, recipient, from, flowers)

  return (
    <ComposerFrame
      subtitle={
        phase === 'designed'
          ? "it's theirs now. send it when you're ready."
          : remixSeed
            ? `write ${remixSeed.from || 'them'} back.`
            : 'Write someone a note. We turn the details into flowers, ready to send.'
      }
      demo={showDemo}
      scene={
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
      }
    >
      {draft.showRecovered && (
        <p className={styles.recoveredDraft} role="status">
          Your draft is still here.
        </p>
      )}

      {phase === 'idle' && remixSeed && (
        <RemixContext
          previous={remixSeed}
          label={remixSeed.from ? `replying to ${remixSeed.from}` : 'replying'}
        />
      )}

      {phase === 'idle' && (
        <>
          <NoteField
            ritual={todaysRitual}
            value={message}
            onChange={setMessage}
            inputRef={messageRef}
            prompt={writingPrompt}
            hasAnotherPrompt={promptOptions.length > 1}
            onAnotherPrompt={() => setPromptIndex((index) => index + 1)}
          />

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

          <ChipPicker
            label="occasion"
            name="occasion"
            options={OCCASIONS}
            value={occasion}
            onChange={setOccasion}
          />
          <ChipPicker label="mood" name="mood" options={MOODS} value={mood} onChange={setMood} />

          {message.trim().length >= 4 && <GardenForecastPanel forecast={forecast} />}
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
            <button className={styles.generateBtn} onClick={runDesign} disabled={!canSubmit}>
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

      {phase === 'designing' && <GrowFeedback statusText={statusText} onCancel={design.cancel} />}

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
          <ShareCard
            shareUrl={shareUrl}
            recipient={recipient}
            copied={copied}
            shareStatus={shareStatus}
            imageStatus={imageStatus}
            canShare={canShare}
            shareError={shareError}
            isRerolling={isRerolling}
            errorText={errorText}
            statusText={statusText}
            scheduleOpen={!!garden.unlockAt}
            unlockLocal={garden.unlockAt ?? ''}
            onShare={handleShare}
            onCopy={handleCopy}
            onSaveImage={handleSaveImage}
            onReroll={() => void design.reroll(draft.fields)}
            onStartOver={handleStartOver}
          />

          <ComposerPreview
            key={gardenId}
            garden={garden}
            shareUrl={shareUrl}
            recipient={recipient}
            from={from}
            message={message}
            secret={secret}
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
    </ComposerFrame>
  )
}
