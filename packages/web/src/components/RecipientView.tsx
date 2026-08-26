import { useCallback, useEffect, useRef, useState } from 'react'
import BouquetNote from './BouquetNote'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import MemoryTrail from './MemoryTrail'
import FlowerJournalShelf from './FlowerJournalShelf'
import SoundToggle from './SoundToggle'
import Watering from './Watering'
import { buildRemixUrl, type GardenData } from '../garden'
import { saveGardenDuetImage, saveGardenImage } from '../lib/gardenImage'
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
  /**
   * The 6-char short ID that identified this garden. Used to build the
   * matching `/r/<id>` reply URL — same KV record, two views. No
   * duplicate writes when someone taps "grow one back."
   */
  gardenId: string
}

type Phase = 'sealed' | 'blooming'

export default function RecipientView({ gardenData, gardenId }: Props) {
  const { flowers, message, secret, from, to, bouquetNote, previous, createdAt, occasion, mood } = gardenData
  const grownOn = formatGardenDate(createdAt)

  // Save-as-image: guard against a double-tap (two share sheets / downloads) and swallow the rare
  // canvas/decode failure so it isn't an unhandled rejection.
  const savingImageRef = useRef(false)
  const savingDuetRef = useRef(false)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [duetStatus, setDuetStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [isReading, setIsReading] = useState(false)
  const [noteCopied, setNoteCopied] = useState(false)
  const [secretRevealed, setSecretRevealed] = useState(false)
  const canReadAloud = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined'
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
      // no-op — the garden stays on screen; the recipient can retry.
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
  // Passing a garden along should feel as easy as receiving it. Native share preserves the
  // platform's familiar destinations; clipboard is the reliable fallback for browsers without it.
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
      // Closing a native sheet is a normal outcome. Leave the garden exactly as it was so a
      // recipient can choose another route (or try again) without seeing an alarming error.
      setShareStatus(null)
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }, [from, shareStatus])

  // Reading a note is an intimate, eyes-up alternative to another share action. Browser speech is
  // completely local — the note is never sent anywhere — and we cancel it on unmount so a garden
  // cannot keep talking after someone follows the reply link.
  const handleReadAloud = useCallback(() => {
    if (!canReadAloud || !message) return
    if (isReading) {
      window.speechSynthesis.cancel()
      setIsReading(false)
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.rate = 0.92
    utterance.pitch = 1.06
    utterance.onend = () => setIsReading(false)
    utterance.onerror = () => setIsReading(false)
    setIsReading(true)
    window.speechSynthesis.speak(utterance)
  }, [canReadAloud, isReading, message])

  const handleCopyNote = useCallback(async () => {
    if (!message || noteCopied) return
    try {
      // Matches what is on screen. The copied text is the thing she pastes into a message to
      // someone else, so a stray em-dash would travel further than the page it came from.
      await navigator.clipboard.writeText(`${message}${from ? `\n\n${from}` : ''}`)
      setNoteCopied(true)
      window.setTimeout(() => setNoteCopied(false), 2200)
    } catch {
      // The garden remains legible and selectable, so a clipboard permission failure needs no alert.
    }
  }, [from, message, noteCopied])

  useEffect(() => () => {
    if (canReadAloud) window.speechSynthesis.cancel()
  }, [canReadAloud])

  // If a signed-in visitor opens a garden, keep it in their Received list (cross-device).
  // Best-effort and idempotent; anonymous visitors are unaffected. When it's newly saved (not
  // your own garden), surface a quiet confirmation so the Received list is discoverable.
  const { user } = useAuth()
  const [savedToGardens, setSavedToGardens] = useState(false)
  useEffect(() => {
    if (!user || !gardenId) return
    let cancelled = false
    void recordReceived(gardenId).then(saved => {
      if (saved && !cancelled) setSavedToGardens(true)
    })
    return () => {
      cancelled = true
    }
  }, [user, gardenId])
  // Auto-dismiss the confirmation after a few seconds so it doesn't linger over the garden.
  useEffect(() => {
    if (!savedToGardens) return
    const t = setTimeout(() => setSavedToGardens(false), 5000)
    return () => clearTimeout(t)
  }, [savedToGardens])
  // The page lands in 'sealed' state — the garden plot is empty, a
  // "open the garden" button sits below it. Tapping the button
  // transitions to 'blooming' AND fires playChime() from inside the
  // gesture handler, so browser autoplay restrictions don't suppress
  // the chime + per-flower bloom sounds.
  const [phase, setPhase] = useState<Phase>('sealed')
  const [msgVisible, setMsgVisible] = useState(false)
  // Re-keying the scene is deliberate: its bloom timeline is local animation state, and replaying
  // should grow the same garden again rather than trying to reverse a finished set of petals.
  const [bloomVersion, setBloomVersion] = useState(0)

  // Funnel event: garden_opened. Fired once per mount — this is the
  // "delivery confirmed" signal that pairs with `share_link_copied`
  // on the sender side. Structural metadata only; no names, no note.
  useEffect(() => {
    trackGardenOpened({
      flowerCount: flowers.length,
      hasFromName: !!from,
      hasThread: !!previous,
    })
  }, [flowers.length, from, previous])

  const handleOpen = (): void => {
    /*
     * The unlock is the one moment this whole product exists for, and it was a plain state swap:
     * the button vanished and the note, the legend and the actions appeared under it in the same
     * frame. `withViewTransition` was already in the codebase, wired only to the composer.
     *
     * Kept short on purpose (see .module.css). The transition cross-fades a snapshot, and the first
     * petal does not open until 460ms, so a 220ms fade is over before the bloom has anything to
     * show — the reveal itself still plays live rather than as a still image.
     */
    withViewTransition(() => {
      setPhase('blooming')
    })
    playChime()
    trackGardenBloomed()
  }

  const handleReplayBloom = (): void => {
    setFocused(null)
    setMsgVisible(false)
    setBloomVersion(version => version + 1)
    // This is still a user gesture, so replaying the gentle chime works on browsers that block
    // background audio. It is a replay, not a second delivery, so it does not inflate the funnel.
    playChime()
  }

  const handleReplyClick = (): void => {
    trackReplyStarted()
    // We don't preventDefault — let the anchor navigate as usual.
    // Analytics is fire-and-forget via sendBeacon under the hood, so
    // it survives the navigation.
  }

  /*
   * Which flower the recipient is looking at, shared by the scene and the legend.
   *
   * The two halves of this screen have never been connected: the garden is a picture and the
   * meanings are a list, and working out which line belongs to which flower means comparing colour
   * swatches by eye. Since every meaning is written about a specific flower, that link is the
   * content, not decoration.
   *
   * Held here rather than in either component because it has to point both ways.
   */
  const [focused, setFocused] = useState<number | null>(null)

  /*
   * Whether the recipient has ever opened a flower.
   *
   * Tapping a flower is the best thing in here — it is where the meaning and the journal live — and
   * nothing on the screen said so, which on a phone means most people never find it. The hint
   * retires itself the moment it has been obeyed rather than sitting there being read twice.
   */
  const [flowerTapped, setFlowerTapped] = useState(false)
  useEffect(() => {
    if (focused !== null) setFlowerTapped(true)
  }, [focused])

  // Bumped on each watering; GardenScene reads it to replay the drops. A counter, not a flag, so
  // the scene doesn't need this component to time a reset.
  const [wateredAt, setWateredAt] = useState(0)

  // Stable across re-renders so GardenScene's bloom effect (which lists onAllBloomed as a dep)
  // doesn't re-fire and replay the whole animation when unrelated state changes — e.g. the
  // "saved to your gardens" pill flipping on after recordReceived resolves.
  const handleAllBloomed = useCallback((): void => {
    setTimeout(() => setMsgVisible(true), 300)
  }, [])

  // The reply URL points at the SAME short ID — `/g/abc123` and
  // `/r/abc123` are two views of one KV record. No duplicate writes.
  const remixHref = buildRemixUrl(gardenId)

  // Save URLs, built once so the prefetch effect and the anchors agree.
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
      <div className={styles.topLabel}>
        {from ? (
          <p className={styles.fromText}>
            <span className={styles.fromName}>{from}</span> grew {to ? to : 'you'} a garden
          </p>
        ) : (
          <p className={styles.fromText}>
            someone grew {to ? to : 'you'} a garden
          </p>
        )}
      </div>

      <GardenScene
        flowers={flowers}
        autoBloom={phase === 'blooming'}
        onAllBloomed={handleAllBloomed}
        focused={focused}
        onFocus={setFocused}
        wateredAt={wateredAt}
        journalGardenId={gardenId}
        journalFrom={from}
        // The sender chose this occasion when they wrote the note;
        // the recipient sees the matching sky tint so the
        // atmosphere reads as deliberate, not random.
        occasion={occasion}
        mood={mood}
        sealed={phase === 'sealed'}
        key={`recipient-${bloomVersion}`}
      />

      {/* "Open the garden" tap target. The bloom is gated on this
          click so the chime + per-flower sounds fire from inside a
          user gesture — otherwise the browser blocks AudioContext
          playback. Also makes the moment feel deliberate, like
          opening an envelope. The button hides once tapped. */}
      {phase === 'sealed' && (
        <>
          <button type="button" className={styles.openBtn} onClick={handleOpen}>
            open the garden
          </button>
          {/* The sealed screen ended at the button and left half a phone of empty page under it.
              Naming the count is also the only honest thing to say here: the garden is already
              grown and written, and nothing about opening it is a lottery. */}
          <p className={styles.waitingLine}>
            {flowers.length} {flowers.length === 1 ? 'flower' : 'flowers'}, already grown.
            <br />
            they have been waiting under there for you.
          </p>
        </>
      )}

      {/* Everything below the plot renders only AFTER the garden is opened. While sealed these
          sections would sit at opacity:0 but still reserve their full height, leaving a large empty
          gap between "open the garden" and the footer on mobile. Mounting them on open (they still
          fade in via msgVisible) collapses that gap and matches the reveal. */}
      {phase === 'blooming' && (
        <>
      {msgVisible && flowers.length > 0 && !flowerTapped && (
        <p className={styles.tapHint}>tap a flower to see what it means</p>
      )}

      {/* Gated on msgVisible, not just on the phase: during the bloom itself the flowers are the
          only thing on this screen that matters, and a button under them would take attention the
          moment does not have to spare. */}
      {msgVisible && gardenId && (
        <Watering gardenId={gardenId} onWatered={() => setWateredAt(n => n + 1)} />
      )}

      <div className={`${styles.messageWrap} ${msgVisible ? styles.visible : ''}`}>
        {message ? (
          <>
            <p className={styles.messageText}>{message}</p>
            {/*
              No dash before the name.
              *
              * A signed note does not have one. The italic, smaller, indented treatment already reads as
              * a signature, so the dash was doing no work that the styling was not already doing, and
              * an em-dash is the one punctuation mark that makes handwritten copy look machine-set.
            */}
            {from && <p className={styles.sig}>{from}</p>}
            {canReadAloud && (
              <button
                type="button"
                className={styles.listenBtn}
                onClick={handleReadAloud}
                aria-pressed={isReading}
              >
                {isReading ? 'pause the note' : 'listen to the note'}
              </button>
            )}
          </>
        ) : (
          <p className={styles.messageText} style={{ fontStyle: 'italic', opacity: 0.6 }}>
            a garden, for you.
          </p>
        )}
        {/* The AI's bouquet rationale, typed out as a postscript on the
            note. `start` is gated on msgVisible so it doesn't type itself
            out before the garden has bloomed and the message faded in. */}
        {bouquetNote && <BouquetNote note={bouquetNote} start={msgVisible} />}
        {secret && (
          <div className={styles.secretNote}>
            <button
              type="button"
              className={styles.secretReveal}
              onClick={() => setSecretRevealed(revealed => !revealed)}
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
        <FlowerLegend flowers={flowers} focused={focused} onFocus={setFocused} />
      </div>

      {/* A reply carries both notes, so let the recipient unfold them as a chronological keepsake
          without making the already-long recipient page permanently taller. */}
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
              <button type="button" className={styles.keepsakeAction} onClick={() => void handleCopyNote()} disabled={noteCopied}>
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

/*
 * The little envelope on the secret row.
 *
 * This was a 💌 next to a ✉ — a full-colour raster emoji swapping to a monochrome text glyph, so
 * the icon changed typeface as well as state, and neither was drawn by us. Same reasoning as the
 * wax seal on the countdown: an emoji is whatever the reader's OS decides to draw, on a page where
 * everything else is ours. Strokes are currentColor so it takes the link's colour and its hover.
 */
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
      {/*
       * The silhouette does not change between states, only the wax does, because the state this
       * button reports is exactly that: sealed or unsealed. Two attempts at a drawn "open" envelope
       * — a raised flap, then a note lifting out of a pocket — both died at 18px, where a three-unit
       * triangle reads as a bump and a cream note on a cream card is a stray line.
       */}
      {!open && (
        <circle cx="10" cy="9.2" r="2.1" fill="var(--pink-mid)" stroke="var(--pink-deep)" strokeWidth="0.8" />
      )}
    </svg>
  )
}
