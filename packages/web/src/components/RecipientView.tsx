import RecipientHeader from './RecipientHeader'
import { useCallback, useEffect, useRef, useState } from 'react'
import BouquetNote from './BouquetNote'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import MemoryTrail from './MemoryTrail'
import FlowerJournalShelf from './FlowerJournalShelf'
import SoundToggle from './SoundToggle'
import Watering from './Watering'
import { buildRemixUrl, type GardenData } from '../garden'
import { prewarmGardenImage, saveGardenDuetImage, saveGardenImage } from '../lib/gardenImage'
import { useAuth } from '../auth/AuthContext'
import { recordReceived } from '../lib/account'
import {
  trackCardDownloaded,
  trackGardenBloomed,
  trackGardenOpened,
  trackGardenReshared,
  trackReplyStarted,
} from '../lib/analytics'
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

  // Guard against a double-tap opening two share sheets, and swallow the rare canvas or decode
  // failure so it isn't an unhandled rejection.
  const savingImageRef = useRef(false)
  const savingDuetRef = useRef(false)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [duetStatus, setDuetStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [noteCopied, setNoteCopied] = useState(false)
  const [secretRevealed, setSecretRevealed] = useState(false)
  const handleSaveImage = useCallback(async () => {
    if (savingImageRef.current) return
    savingImageRef.current = true
    setImageStatus('saving')
    try {
      const result = await saveGardenImage({ flowers, from, to })
      if (result === 'dismissed') {
        setImageStatus(null)
        return
      }
      setImageStatus(result)
      if (result === 'downloaded') trackCardDownloaded('recipient', 'square')
      window.setTimeout(() => setImageStatus(null), 2500)
    } catch {
      // The garden stays on screen, so the recipient can just try again.
      setImageStatus(null)
    } finally {
      savingImageRef.current = false
    }
  }, [flowers, from, to])
  const handleSaveDuet = useCallback(async () => {
    if (!previous || savingDuetRef.current) return
    savingDuetRef.current = true
    setDuetStatus('saving')
    try {
      const result = await saveGardenDuetImage({ previous, current: gardenData })
      if (result === 'dismissed') {
        setDuetStatus(null)
        return
      }
      setDuetStatus(result)
      if (result === 'downloaded') trackCardDownloaded('recipient', 'duet')
      window.setTimeout(() => setDuetStatus(null), 2500)
    } catch {
      setDuetStatus(null)
    } finally {
      savingDuetRef.current = false
    }
  }, [gardenData, previous])
  const handleShareGarden = useCallback(async () => {
    if (shareStatus) return
    setShareStatus('sharing')
    const shareData: ShareData = {
      title: 'bloomnote',
      text: from ? `A garden from ${from}` : 'A garden for you',
      url: window.location.href,
    }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData)
        setShareStatus('shared')
        trackGardenReshared('native')
      } else {
        await navigator.clipboard.writeText(window.location.href)
        setShareStatus('copied')
        trackGardenReshared('copy')
      }
      window.setTimeout(() => setShareStatus(null), 2500)
    } catch (err) {
      // Closing a native sheet is a normal outcome, not an error. Leave the garden as it was.
      setShareStatus(null)
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }, [from, shareStatus])

  const handleCopyNote = useCallback(async () => {
    if (!message || noteCopied) return
    try {
      // This is the text she pastes into a message to someone else, so a stray em dash would travel
      // further than the page it came from.
      await navigator.clipboard.writeText(`${message}${from ? `\n\n${from}` : ''}`)
      setNoteCopied(true)
      window.setTimeout(() => setNoteCopied(false), 2200)
    } catch {
      // The garden is still legible and selectable, so a clipboard failure needs no alert.
    }
  }, [from, message, noteCopied])

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

  // Stable across re-renders. GardenScene's bloom effect lists onAllBloomed as a dep, so a new
  // identity replays the whole animation when unrelated state changes.
  const handleAllBloomed = useCallback((): void => {
    setTimeout(() => setMsgVisible(true), 300)
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

          <div className={`${styles.messageWrap} ${msgVisible ? styles.visible : ''}`}>
            {message ? (
              <>
                <p className={styles.messageText}>{message}</p>
                {from && <p className={styles.sig}>{from}</p>}
              </>
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

          <div className={`${styles.legendWrap} ${msgVisible ? styles.visible : ''}`}>
            <FlowerLegend
              flowers={flowers}
              focused={focused}
              onFocus={focusFlower}
              onFocusRelease={releaseFlower}
            />
          </div>

          {previous && (
            <div className={`${styles.threadWrap} ${msgVisible ? styles.visible : ''}`}>
              <MemoryTrail previous={previous} current={gardenData} />
            </div>
          )}

          <div className={`${styles.cta} ${msgVisible ? styles.visible : ''}`}>
            <p className={styles.ctaText}>grow one back?</p>
            <a href={remixHref} className={styles.ctaBtn} onClick={handleReplyClick}>
              {from ? `grow ${from} a garden` : 'grow one back'}
            </a>
            <button
              type="button"
              className={styles.ctaShareBtn}
              onClick={() => void handleShareGarden()}
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
              <summary>keep this garden</summary>
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
                          ? 'garden duet saved'
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
                        ? 'image downloaded'
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

export function SecretEnvelope({ open }: { open: boolean }) {
  return (
    <svg width="18" height="14" viewBox="0 0 20 15" fill="none" aria-hidden focusable="false">
      <rect
        x="1"
        y="2.6"
        width="18"
        height="11.8"
        rx="2.2"
        fill="var(--cream)"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M1.7 3.3 L10 9.1 L18.3 3.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Only the wax changes between states, because sealed-or-unsealed is exactly what this button
          reports. */}
      {!open && (
        <circle cx="10" cy="9.2" r="2.1" fill="var(--pink-mid)" stroke="var(--pink-deep)" strokeWidth="0.8" />
      )}
    </svg>
  )
}
