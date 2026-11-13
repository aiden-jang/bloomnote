import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ComposerPreview from './ComposerPreview'
import NoteField from './NoteField'
import ExampleCarousel from './ExampleCarousel'
import GardenScene from './GardenScene'
import RemixContext from './RemixContext'
import ShareCard from './ShareCard'
import ComposerFrame from './ComposerFrame'
import ComposerLetter from './ComposerLetter'
import ComposerOptions from './ComposerOptions'
import { type ExampleGarden } from '../data/exampleGardens'
import { type GardenData } from '../garden'
import { trackComposerOpened } from '../lib/analytics'
import { useGardenDesign } from '../lib/useGardenDesign'
import { countSentGardens } from '../lib/mine'
import { PetalFall } from './ComposerBloom'
import GrowFeedback from './GrowFeedback'
import { prewarmGardenImage } from '../lib/gardenImage'
import { gardenForecast } from '../lib/gardenForecast'
import { placeholderFor, placeholderOptions } from '../lib/placeholders'
import { ritual } from '../lib/rituals'
import { prefersReducedMotion } from '../lib/motion'
import styles from './Composer.module.css'
import letter from './ComposerLetter.module.css'
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

  // Wait for the iOS keyboard before scrolling; earlier measurements use the covered viewport.
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
  const undoRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (undoDraft && document.activeElement === document.body) undoRef.current?.focus()
  }, [undoDraft])
  const handleUndoClear = () => {
    draft.undoClear()
    requestAnimationFrame(() => messageRef.current?.focus())
  }
  const handleDismissUndo = draft.dismissUndo

  const { copied, shareStatus, imageStatus, canShare, shareError, handleCopy, handleShare, handleSaveImage } =
    useShareActions(shareUrl, recipient, from, flowers)

  const scene = (
    <GardenScene
      variant="meadow"
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
  )

  return (
    <ComposerFrame
      footer={
        mineCount > 0 && (
          <footer className={styles.footer}>
            <p className={styles.footerNav}>
              <a href="/mine">your gardens</a>
            </p>
          </footer>
        )
      }
      intro={
        phase === 'idle'
          ? remixSeed
            ? `write ${remixSeed.from || 'them'} back.`
            : 'Write the thing only you would say.'
          : undefined
      }
      preview={
        phase === 'designed' && garden && shareUrl ? (
          <ComposerPreview
            key={gardenId}
            garden={garden}
            shareUrl={shareUrl}
            recipient={recipient}
            from={from}
            message={message}
            secret={secret}
          />
        ) : null
      }
      writing={phase === 'idle'}
      demo={showDemo}
      scene={scene}
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
          <div>
            <ComposerLetter fields={draft.fields} set={draft.set}>
              <NoteField
                ritual={todaysRitual}
                value={message}
                onChange={draft.set.message}
                inputRef={messageRef}
                prompt={writingPrompt}
                hasAnotherPrompt={promptOptions.length > 1}
                onAnotherPrompt={() => setPromptIndex((index) => index + 1)}
              />
            </ComposerLetter>
            <ComposerOptions
              fields={draft.fields}
              set={draft.set}
              forecast={forecast}
              scheduleError={scheduleError}
            />
            {errorText && (
              <div className={styles.error} role="alert">
                {errorText}
              </div>
            )}

            <div className={letter.send}>
              <p>
                Your words become the flowers.
                <br />
                You choose when to share the link.
              </p>
              <div className={styles.actions}>
                <button className={styles.generateBtn} onClick={runDesign} disabled={!canSubmit}>
                  {remixSeed
                    ? 'grow one back'
                    : `grow ${recipient.trim() ? `${recipient.trim()}’s` : 'their'} garden`}
                </button>
              </div>
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
          </div>

          {!remixSeed && (
            <ExampleCarousel
              onSelect={handleExampleSelect}
              collapsed={hasDraft}
              activeId={hero.activeId}
              onPreview={hero.preview}
            />
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
        <GrowFeedback statusText={statusText} onCancel={design.cancel} scene={scene} message={message} />
      )}

      {undoDraft && (
        <div className={styles.undoToast} role="status" aria-live="polite">
          <span>draft cleared</span>
          <button type="button" ref={undoRef} className={styles.undoBtn} onClick={handleUndoClear}>
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
        <ShareCard
          scene={scene}
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
      )}
    </ComposerFrame>
  )
}
