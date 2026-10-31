import StationeryArt from './StationeryArt'
import ReadingSize from './ReadingSize'
import RecipientHeader from './RecipientHeader'
import { useCallback, useEffect, useRef, useState } from 'react'
import BouquetNote from './BouquetNote'
import { SecretEnvelope } from './SecretEnvelope'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import MemoryTrail from './MemoryTrail'
import FlowerJournalShelf from './FlowerJournalShelf'
import SoundToggle from './SoundToggle'
import Watering from './Watering'
import { buildRemixUrl, type GardenData } from '../garden'
import { prewarmGardenImage } from '../lib/gardenImage'
import { useAuth } from '../auth/AuthContext'
import { recordReceived } from '../lib/account'
import { trackGardenBloomed, trackGardenOpened, trackReplyStarted } from '../lib/analytics'
import { useRecipientKeepsakes } from '../lib/useRecipientKeepsakes'
import { formatGardenDate } from '../lib/formatDate'
import { playChime } from '../sound'
import { withViewTransition } from '../lib/viewTransition'
import styles from './RecipientView.module.css'

interface Props {
  gardenData: GardenData
  gardenId: string
}

/* Long enough to cross the gap to the panel on purpose, short enough that leaving still feels
   like letting go. */
const FLOWER_PANEL_GRACE_MS = 260

type Phase = 'sealed' | 'blooming'

export default function RecipientView({ gardenData, gardenId }: Props) {
  const { flowers, message, secret, from, to, bouquetNote, previous, createdAt, occasion, mood } = gardenData
  const grownOn = formatGardenDate(createdAt)

  const {
    shareStatus,
    imageStatus,
    duetStatus,
    noteCopied,
    shareError,
    handleSaveImage,
    handleSaveDuet,
    handleShareGarden,
    handleCopyNote,
  } = useRecipientKeepsakes(gardenData)
  const [secretRevealed, setSecretRevealed] = useState(false)

  const { user } = useAuth()
  const [savedToGardens, setSavedToGardens] = useState(false)
  useEffect(() => {
    if (!user || !gardenId) return
    let cancelled = false
    void recordReceived(gardenId).then((saved) => {
      if (saved && !cancelled) setSavedToGardens(true)
    })
    return () => {
      cancelled = true
    }
  }, [user, gardenId])
  useEffect(() => {
    if (!savedToGardens) return
    const t = setTimeout(() => setSavedToGardens(false), 5000)
    return () => clearTimeout(t)
  }, [savedToGardens])
  const [phase, setPhase] = useState<Phase>('sealed')
  const [msgVisible, setMsgVisible] = useState(false)
  // Re-key rather than reverse: the bloom timeline is local animation state, and replaying
  // should grow the same garden again.
  const [bloomVersion, setBloomVersion] = useState(0)

  useEffect(() => {
    trackGardenOpened({
      flowerCount: flowers.length,
      hasFromName: !!from,
      hasThread: !!previous,
    })
  }, [flowers.length, from, previous])

  const headingRef = useRef<HTMLHeadingElement>(null)

  const handleOpen = (): void => {
    /* Kept to 220ms (see .module.css). A view transition cross-fades a snapshot, so anything
       animating underneath is frozen; the first petal opens at 460ms and the bloom must play live. */
    withViewTransition(() => {
      setPhase('blooming')
    })
    playChime()
    trackGardenBloomed()
    headingRef.current?.focus()
  }

  const handleReplayBloom = (): void => {
    if (revealTimer.current) clearTimeout(revealTimer.current)
    setFocused(null)
    setMsgVisible(false)
    setBloomVersion((version) => version + 1)
    playChime()
  }

  const handleReplyClick = (): void => {
    trackReplyStarted()
  }

  const [focused, setFocused] = useState<number | null>(null)

  const releaseTimer = useRef<number | null>(null)
  const focusFlower = useCallback((index: number | null) => {
    if (releaseTimer.current !== null) {
      window.clearTimeout(releaseTimer.current)
      releaseTimer.current = null
    }
    setFocused(index)
  }, [])
  const releaseFlower = useCallback(() => {
    if (releaseTimer.current !== null) window.clearTimeout(releaseTimer.current)
    releaseTimer.current = window.setTimeout(() => {
      releaseTimer.current = null
      /* A panel holding focus stays open. Someone typing a memory has their hands off the mouse, and
         a drifting pointer must not close what they are writing in. */
      if (document.activeElement?.closest('[data-flower-peek]')) return
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
    if (!msgVisible || flowers.length === 0) return
    prewarmGardenImage({ flowers, from, to })
  }, [msgVisible, flowers, from, to])

  // A counter, not a flag, so the scene can replay the drops without this component timing a reset.
  const [wateredAt, setWateredAt] = useState(0)

  const revealTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (revealTimer.current) clearTimeout(revealTimer.current)
    },
    [],
  )
  // A stable callback preserves the bloom timeline across unrelated state changes.
  const handleAllBloomed = useCallback((): void => {
    revealTimer.current = setTimeout(() => setMsgVisible(true), 300)
  }, [])

  // The reply URL points at the SAME short id: `/g/abc123` and `/r/abc123` are two views of one
  // KV record, not two writes.
  const remixHref = buildRemixUrl(gardenId)

  return (
    <div className={styles.wrap}>
      <SoundToggle />
      {savedToGardens && (
        <a
          href="/mine?tab=received"
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 60,
            padding: '9px 16px',
            borderRadius: 999,
            background: 'rgba(250, 246, 238, 0.92)',
            border: '1px solid var(--green-pale, #e2e8dc)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            color: 'var(--color-ink-muted, #6b6963)',
            textDecoration: 'none',
            fontSize: '0.85rem',
            boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
          }}
        >
          saved to your gardens →
        </a>
      )}
      <RecipientHeader from={from} to={to} headingRef={headingRef} />

      <GardenScene
        flowers={flowers}
        autoBloom={phase === 'blooming'}
        onAllBloomed={handleAllBloomed}
        focused={focused}
        onFocus={focusFlower}
        onFocusRelease={releaseFlower}
        wateredAt={wateredAt}
        journalGardenId={gardenId}
        journalFrom={from}
        occasion={occasion}
        mood={mood}
        sealed={phase === 'sealed'}
        key={`recipient-${bloomVersion}`}
      />

      {phase === 'sealed' && (
        <>
          <button type="button" className={styles.openBtn} onClick={handleOpen}>
            open the garden
          </button>
          <p className={styles.waitingLine}>
            {flowers.length} {flowers.length === 1 ? 'flower' : 'flowers'}, already grown.
            <br />
            they have been waiting under there for you.
          </p>
        </>
      )}

      {/* Everything below the plot renders only after the garden is opened. While sealed these would
          sit at opacity 0, present and focusable but invisible. */}
      {phase === 'blooming' && (
        <>
          {msgVisible && flowers.length > 0 && !flowerTapped && (
            <p className={styles.tapHint}>tap a flower to see what it means</p>
          )}

          {msgVisible && gardenId && (
            <Watering gardenId={gardenId} onWatered={() => setWateredAt((n) => n + 1)} />
          )}

          <div
            className={`${styles.messageWrap} ${msgVisible ? styles.visible : ''}`}
            aria-hidden={!msgVisible}
            style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
          >
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
                  {secretRevealed ? 'hide the little secret' : 'there’s a little secret in here'}
                </button>
                {secretRevealed && <p className={styles.secretText}>{secret}</p>}
              </div>
            )}
            {grownOn && <p className={styles.grownOn}>grown {grownOn}</p>}
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
              onFocusRelease={releaseFlower}
            />
          </div>

          {previous && (
            <div
              className={`${styles.threadWrap} ${msgVisible ? styles.visible : ''}`}
              aria-hidden={!msgVisible}
              style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
            >
              <MemoryTrail previous={previous} current={gardenData} />
            </div>
          )}

          <div
            className={`${styles.cta} ${msgVisible ? styles.visible : ''}`}
            aria-hidden={!msgVisible}
            style={{ visibility: msgVisible ? 'visible' : 'hidden' }}
          >
            {shareError && (
              <div className={styles.shareFallback}>
                <p role="alert">{shareError}</p>
                <label>
                  Garden link
                  <input
                    readOnly
                    value={window.location.href}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                </label>
              </div>
            )}
            <p className={styles.ctaText}>grow one back?</p>
            <a href={remixHref} className={styles.ctaBtn} onClick={handleReplyClick}>
              {from ? `grow ${from} a garden` : 'grow one back'}
            </a>
            <button
              type="button"
              className={styles.ctaShareBtn}
              onClick={(event) => void handleShareGarden(event.currentTarget)}
              disabled={shareStatus !== null}
            >
              {shareStatus === 'sharing'
                ? 'opening share sheet…'
                : shareStatus === 'shared'
                  ? 'garden shared'
                  : shareStatus === 'copied'
                    ? 'link copied'
                    : 'share this garden'}
            </button>
            <details className={styles.keepsake}>
              <summary>
                <StationeryArt kind="bookmark" />
                <span>keep this garden</span>
              </summary>
              <div className={styles.keepsakeActions}>
                {previous && (
                  <button
                    type="button"
                    className={styles.keepsakeAction}
                    onClick={() => void handleSaveDuet()}
                    disabled={duetStatus !== null}
                  >
                    {duetStatus === 'saving'
                      ? 'pressing both gardens…'
                      : duetStatus === 'shared'
                        ? 'garden duet shared'
                        : duetStatus === 'downloaded'
                          ? 'download started'
                          : 'save both as a garden duet'}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.keepsakeAction}
                  onClick={() => void handleSaveImage()}
                  disabled={imageStatus !== null}
                >
                  {imageStatus === 'saving'
                    ? 'making image…'
                    : imageStatus === 'shared'
                      ? 'image shared'
                      : imageStatus === 'downloaded'
                        ? 'download started'
                        : 'save it as an image'}
                </button>
                {message && (
                  <button
                    type="button"
                    className={styles.keepsakeAction}
                    onClick={() => void handleCopyNote()}
                    disabled={noteCopied}
                  >
                    {noteCopied ? 'note copied' : 'copy the note'}
                  </button>
                )}
                <button type="button" className={styles.keepsakeAction} onClick={() => window.print()}>
                  print the garden
                </button>
                <button type="button" className={styles.keepsakeAction} onClick={handleReplayBloom}>
                  watch it bloom again
                </button>
              </div>
              <FlowerJournalShelf currentGardenId={gardenId} />
            </details>
            <p className={styles.ctaSub}>
              <a href="/" className={styles.ctaSubLink}>
                start one for someone new
              </a>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
