import { useEffect, useState } from 'react'
import BouquetNote from './BouquetNote'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import SoundToggle from './SoundToggle'
import { buildRemixUrl, type GardenData } from '../garden'
import {
  trackGardenBloomed,
  trackGardenOpened,
  trackReplyStarted,
} from '../lib/analytics'
import { formatGardenDate } from '../lib/formatDate'
import { saveSharedImage } from '../lib/saveImage'
import { playChime } from '../sound'
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
  const { flowers, message, from, to, bouquetNote, previous, createdAt, occasion } = gardenData
  const grownOn = formatGardenDate(createdAt)
  // The page lands in 'sealed' state — the garden plot is empty, a
  // "open the garden" button sits below it. Tapping the button
  // transitions to 'blooming' AND fires playChime() from inside the
  // gesture handler, so browser autoplay restrictions don't suppress
  // the chime + per-flower bloom sounds.
  const [phase, setPhase] = useState<Phase>('sealed')
  const [msgVisible, setMsgVisible] = useState(false)

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
    setPhase('blooming')
    playChime()
    trackGardenBloomed()
  }

  const handleReplyClick = (): void => {
    trackReplyStarted()
    // We don't preventDefault — let the anchor navigate as usual.
    // Analytics is fire-and-forget via sendBeacon under the hood, so
    // it survives the navigation.
  }

  function handleAllBloomed(): void {
    setTimeout(() => setMsgVisible(true), 300)
  }

  // The reply URL points at the SAME short ID — `/g/abc123` and
  // `/r/abc123` are two views of one KV record. No duplicate writes.
  const remixHref = buildRemixUrl(gardenId)

  return (
    <div className={styles.wrap}>
      <SoundToggle />
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
        // The sender chose this occasion when they wrote the note;
        // the recipient sees the matching sky tint so the
        // atmosphere reads as deliberate, not random.
        occasion={occasion}
        key="recipient"
      />

      {/* "Open the garden" tap target. The bloom is gated on this
          click so the chime + per-flower sounds fire from inside a
          user gesture — otherwise the browser blocks AudioContext
          playback. Also makes the moment feel deliberate, like
          opening an envelope. The button hides once tapped. */}
      {phase === 'sealed' && (
        <button type="button" className={styles.openBtn} onClick={handleOpen}>
          open the garden
        </button>
      )}

      <div className={`${styles.messageWrap} ${msgVisible ? styles.visible : ''}`}>
        {message ? (
          <>
            <p className={styles.messageText}>{message}</p>
            {from && <p className={styles.sig}>— {from}</p>}
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
        {grownOn && <p className={styles.grownOn}>grown {grownOn}</p>}
      </div>

      <div className={`${styles.legendWrap} ${msgVisible ? styles.visible : ''}`}>
        <FlowerLegend flowers={flowers} />
      </div>

      {/* Thread context — when this garden is itself a reply, show the
          garden it was a reply TO. The current viewer (e.g. Sarah) sees
          Maya's garden, plus a glance back at the note she originally
          sent Maya. Makes the conversation feel like a conversation. */}
      {previous && (
        <div className={`${styles.threadWrap} ${msgVisible ? styles.visible : ''}`}>
          <RemixContext
            previous={previous}
            label={`you wrote this to ${previous.to || from || 'them'}`}
          />
        </div>
      )}

      <div className={`${styles.cta} ${msgVisible ? styles.visible : ''}`}>
        <p className={styles.ctaText}>grow one back?</p>
        <a href={remixHref} className={styles.ctaBtn} onClick={handleReplyClick}>
          {from ? `grow ${from} a garden` : 'grow one back'}
        </a>
        <p className={styles.ctaSub}>
          or{' '}
          <a href="/" className={styles.ctaSubLink}>
            start one for someone new
          </a>
        </p>
        {/* Save-as-image — only show if we have a short ID (always do
            for KV-backed gardens). Recipient downloads typically end up
            as personal keepsakes or screenshots; we still track the
            event because spikes here are a signal that "the bloom is
            beautiful enough to capture," which informs design choices.
            On phones the onClick routes through the share sheet so the
            image saves to Photos instead of Files (see saveSharedImage);
            desktop keeps the plain download. */}
        {gardenId && (
          <p className={styles.downloadRow}>
            <a
              href={`/api/card?id=${encodeURIComponent(gardenId)}&download=1`}
              download
              className={styles.downloadLink}
              onClick={e => saveSharedImage(e, 'recipient', 'square')}
            >
              save as image
            </a>
            <span className={styles.downloadSep} aria-hidden>·</span>
            <a
              href={`/api/story?id=${encodeURIComponent(gardenId)}&download=1`}
              download
              className={styles.downloadLink}
              onClick={e => saveSharedImage(e, 'recipient', 'story')}
            >
              save as story
            </a>
          </p>
        )}
      </div>

      {/* Author credit. Quieter than Composer's because this is the
          recipient's emotional moment — they shouldn't feel watermarked.
          Hidden in print so a physical card doesn't carry attribution. */}
      <p className={styles.credit}>
        made by{' '}
        <a href="https://www.aidenjang.com" target="_blank" rel="noreferrer">
          aiden jang
        </a>
      </p>
    </div>
  )
}
