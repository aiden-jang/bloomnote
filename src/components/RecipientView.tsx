import { useState } from 'react'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import { buildRemixUrl, type GardenData } from '../garden'
import { clearDraft } from '../lib/draft'
import { formatGardenDate } from '../lib/formatDate'
import { playChime } from '../sound'
import styles from './RecipientView.module.css'

interface Props {
  gardenData: GardenData
}

type Phase = 'sealed' | 'blooming'

export default function RecipientView({ gardenData }: Props) {
  const { flowers, message, from, to, bouquetNote, previous, createdAt } = gardenData
  const grownOn = formatGardenDate(createdAt)
  // The page lands in 'sealed' state — the garden plot is empty, a
  // "open the garden" button sits below it. Tapping the button
  // transitions to 'blooming' AND fires playChime() from inside the
  // gesture handler, so browser autoplay restrictions don't suppress
  // the chime + per-flower bloom sounds.
  const [phase, setPhase] = useState<Phase>('sealed')
  const [msgVisible, setMsgVisible] = useState(false)

  const handleOpen = (): void => {
    setPhase('blooming')
    playChime()
  }

  function handleAllBloomed(): void {
    setTimeout(() => setMsgVisible(true), 300)
  }

  const remixHref = buildRemixUrl(gardenData)

  return (
    <div className={styles.wrap}>
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
        {bouquetNote && (
          <p className={styles.bouquetNote}>{bouquetNote}</p>
        )}
        {message ? (
          <>
            <p className={styles.messageText}>{message}</p>
            {from && <p className={styles.sig}>— {from}</p>}
          </>
        ) : !bouquetNote ? (
          <p className={styles.messageText} style={{ fontStyle: 'italic', opacity: 0.6 }}>
            a garden, for you.
          </p>
        ) : null}
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
        <a href={remixHref} className={styles.ctaBtn}>
          {from ? `grow ${from} a garden` : 'grow one back'}
        </a>
        <p className={styles.ctaSub}>
          or{' '}
          <a
            href="/"
            className={styles.ctaSubLink}
            // Wipe the localStorage draft synchronously before the
            // navigation kicks in — so when the composer mounts on
            // the next page, loadDraft() returns null and the form
            // is empty. "Start one for someone new" should feel
            // genuinely fresh.
            onClick={() => clearDraft()}
          >
            start one for someone new
          </a>
        </p>
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
