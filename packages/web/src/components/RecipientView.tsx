import GiftPacket, { GIFT_OPEN_MS } from './GiftPacket'
import RecipientActions from './RecipientActions'
import PaperFlower from './PaperFlower'
import ReadingSize from './ReadingSize'
import RecipientHeader from './RecipientHeader'
import { useCallback, useEffect, useRef, useState } from 'react'
import BouquetNote from './BouquetNote'
import { SecretEnvelope } from './SecretEnvelope'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import MemoryTrail from './MemoryTrail'
import LetterHeader from './LetterHeader'
import Watering from './Watering'
import type { GardenData } from '../garden'
import { prewarmGardenImage } from '../lib/gardenImage'
import { useAuth } from '../auth/AuthContext'
import { recordReceived } from '../lib/account'
import { trackGardenBloomed, trackGardenOpened } from '../lib/analytics'
import { formatGardenDate } from '../lib/formatDate'
import { playChime } from '../sound'
import { prefersReducedMotion } from '../lib/motion'
import styles from './RecipientView.module.css'

interface Props {
  gardenData: GardenData
  gardenId: string
  preview?: boolean
}

/* Long enough to cross the gap to the panel on purpose, short enough that leaving still feels
   like letting go. */
const FLOWER_PANEL_GRACE_MS = 260

type Phase = 'sealed' | 'opening' | 'blooming'

export default function RecipientView({ gardenData, gardenId, preview = false }: Props) {
  const { flowers, message, secret, from, to, bouquetNote, previous, createdAt, occasion, mood } = gardenData
  const grownOn = formatGardenDate(createdAt)

  const [secretRevealed, setSecretRevealed] = useState(false)

  const { user } = useAuth()
  const [savedFor, setSavedFor] = useState<{ accountId: string; gardenId: string } | null>(null)
  useEffect(() => {
    if (preview || !user || !gardenId) return
    let cancelled = false
    void recordReceived(gardenId).then((saved) => {
      if (saved && !cancelled) setSavedFor({ accountId: user.id, gardenId })
    })
    return () => {
      cancelled = true
    }
  }, [user, gardenId, preview])
  const [phase, setPhase] = useState<Phase>('sealed')
  const [msgVisible, setMsgVisible] = useState(false)
  // Re-key rather than reverse: the bloom timeline is local animation state, and replaying
  // should grow the same garden again.
  const [bloomVersion, setBloomVersion] = useState(0)

  useEffect(() => {
    if (preview) return
    trackGardenOpened({
      flowerCount: flowers.length,
      hasFromName: !!from,
      hasThread: !!previous,
    })
  }, [flowers.length, from, previous, preview])

  const headingRef = useRef<HTMLHeadingElement>(null)
  const packetRef = useRef<HTMLButtonElement>(null)

  const handleOpen = (): void => {
    setPhase(prefersReducedMotion() ? 'blooming' : 'opening')
    playChime()
    if (!preview) trackGardenBloomed()
  }

  useEffect(() => {
    if (phase === 'opening') {
      const timer = setTimeout(() => setPhase('blooming'), GIFT_OPEN_MS)
      return () => clearTimeout(timer)
    }
    if (phase === 'blooming') headingRef.current?.focus()
  }, [phase])

  const handleReplayBloom = (): void => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    setFocused(null)
    setMsgVisible(false)
    setBloomVersion((version) => version + 1)
    playChime()
  }

  const [focused, setFocused] = useState<number | null>(null)

  const panelPinned = useRef(false)
  const releaseTimer = useRef<number | null>(null)
  const focusFlower = useCallback((index: number | null) => {
    panelPinned.current = false
    if (releaseTimer.current !== null) {
      window.clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }
    setFocused(index)
  }, [])
  const previewFlower = useCallback(
    (index: number | null) => {
      if (!panelPinned.current) focusFlower(index)
    },
    [focusFlower],
  )
  const releaseFlower = useCallback(() => {
    if (panelPinned.current) return
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(() => {
      releaseTimer.current = null
      /* A panel holding focus stays open. Someone typing a memory has their hands off the mouse, and
         a drifting pointer must not close what they are writing in. */
      if (panelPinned.current || document.activeElement?.closest('[data-flower-peek]')) return
      setFocused(null)
    }, FLOWER_PANEL_GRACE_MS)
  }, [])
  useEffect(
    () => () => {
      if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current)
    },
    [],
  )

  const [flowerTapped, setFlowerTapped] = useState(false)
  useEffect(() => {
    if (focused !== null) setFlowerTapped(true)
  }, [focused])

  /* Render the PNG before the tap: navigator.share needs the gesture still live. */
  useEffect(() => {
    if (preview || !msgVisible || flowers.length === 0) return
    prewarmGardenImage({ flowers, from, to })
  }, [msgVisible, flowers, from, to, preview])

  // A counter, not a flag, so the scene can replay the drops without this component timing a reset.
  const [wateredAt, setWateredAt] = useState(0)

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (phase !== 'blooming') return
    // The sender's words arrive promptly, independently of the number of flowers.
    revealTimer.current = setTimeout(() => setMsgVisible(true), prefersReducedMotion() ? 0 : 1200)
    return () => {
      if (revealTimer.current) clearTimeout(revealTimer.current)
    }
  }, [phase, bloomVersion])
  const handleAllBloomed = useCallback(() => setMsgVisible(true), [])

  const rewrap = () => {
    setPhase('sealed')
    setMsgVisible(false)
    focusFlower(null)
    setSecretRevealed(false)
    setFlowerTapped(false)
    setBloomVersion((version) => version + 1)
    requestAnimationFrame(() => packetRef.current?.focus())
  }

  return (
    <div
      data-letter-page={preview ? undefined : 'recipient'}
      data-recipient-preview={preview || undefined}
      className={preview ? styles.inlinePreview : styles.wrap}
      onPointerDownCapture={({ target }) => {
        if (target instanceof Element && target.closest('[data-flower-peek]')) panelPinned.current = true
      }}
      onFocusCapture={({ target }) => {
        if (target instanceof Element && target.closest('[data-flower-peek]')) panelPinned.current = true
      }}
    >
      {!preview && <LetterHeader />}
      {preview && phase === 'blooming' && (
        <div className={styles.previewBar}>
          <span>Recipient preview</span>
          <button type="button" onClick={rewrap}>
            wrap it back up
          </button>
        </div>
      )}
      {(!preview || phase === 'blooming') && (
        <RecipientHeader
          from={from}
          to={to}
          headingRef={headingRef}
          saved={!preview && savedFor?.accountId === user?.id && savedFor?.gardenId === gardenId}
          preview={preview}
        />
      )}

      <div className={styles.folio}>
        <div className={styles.gardenPlot}>
          {phase !== 'blooming' ? (
            <GiftPacket
              from={from}
              to={to}
              count={flowers.length}
              opening={phase === 'opening'}
              onOpen={handleOpen}
              buttonRef={packetRef}
              flowers={preview ? flowers : undefined}
              actionLabel={preview ? 'preview the opening' : 'open the garden'}
            />
          ) : (
            <GardenScene
              variant="meadow"
              flowers={flowers}
              autoBloom={phase === 'blooming'}
              onAllBloomed={handleAllBloomed}
              focused={focused}
              onFocus={focusFlower}
              onPreview={previewFlower}
              wateredAt={wateredAt}
              journalGardenId={preview ? undefined : gardenId}
              readOnly={preview}
              journalFrom={from}
              occasion={occasion}
              mood={mood}
              key={`recipient-${bloomVersion}`}
            />
          )}
          {msgVisible && flowers.length > 0 && !flowerTapped && (
            <p className={styles.tapHint}>tap a flower to see what it means</p>
          )}

          {!preview && msgVisible && gardenId && (
            <Watering gardenId={gardenId} onWatered={() => setWateredAt((n) => n + 1)} />
          )}
        </div>

        {/* Everything below the plot renders only after the garden is opened. While sealed these would
          sit at opacity 0, present and focusable but invisible. */}
        {phase === 'blooming' && (
          <>
            <div className={styles.letterSide}>
              <div
                className={`${styles.messageWrap} ${msgVisible ? styles.visible : ''}`}
                aria-hidden={!msgVisible}
                style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
              >
                <span className={styles.paperMark} aria-hidden="true">
                  <PaperFlower />
                </span>
                {message ? (
                  <ReadingSize>
                    <p className={styles.messageText}>{message}</p>
                    {from && <p className={styles.sig}>{from}</p>}
                  </ReadingSize>
                ) : (
                  <p className={styles.messageText} style={{ fontStyle: 'italic', opacity: 0.6 }}>
                    a garden, for you.
                  </p>
                )}
                {bouquetNote && <BouquetNote note={bouquetNote} start={msgVisible} />}
                {secret && (
                  <div className={styles.secretNote}>
                    <button
                      type="button"
                      className={styles.secretReveal}
                      onClick={() => setSecretRevealed((revealed) => !revealed)}
                      aria-expanded={secretRevealed}
                    >
                      <SecretEnvelope open={secretRevealed} />
                      {secretRevealed ? 'hide the secret' : 'a secret for you'}
                    </button>
                    {secretRevealed && <p className={styles.secretText}>{secret}</p>}
                  </div>
                )}
                {grownOn && <p className={styles.grownOn}>grown {grownOn}</p>}
              </div>

              {!preview && (
                <RecipientActions
                  gardenData={gardenData}
                  gardenId={gardenId}
                  msgVisible={msgVisible}
                  onReplay={handleReplayBloom}
                />
              )}
            </div>
            <div
              className={`${styles.legendWrap} ${msgVisible ? styles.visible : ''}`}
              aria-hidden={!msgVisible}
              style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
            >
              <FlowerLegend
                flowers={flowers}
                focused={focused}
                onFocus={focusFlower}
                onPreview={previewFlower}
                onFocusRelease={releaseFlower}
              />
            </div>

            {!preview && previous && (
              <div
                className={`${styles.threadWrap} ${msgVisible ? styles.visible : ''}`}
                aria-hidden={!msgVisible}
                style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
              >
                <MemoryTrail previous={previous} current={gardenData} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
