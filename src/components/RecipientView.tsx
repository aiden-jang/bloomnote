import { useState, useEffect } from 'react'
import GardenScene from './GardenScene'
import FlowerLegend from './FlowerLegend'
import RemixContext from './RemixContext'
import { buildRemixUrl, type GardenData } from '../garden'
import { playChime } from '../sound'
import styles from './RecipientView.module.css'

interface Props {
  gardenData: GardenData
}

type Phase = 'waiting' | 'blooming'

export default function RecipientView({ gardenData }: Props) {
  const { flowers, message, from, to, bouquetNote, previous } = gardenData
  const [phase, setPhase] = useState<Phase>('waiting')
  const [msgVisible, setMsgVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('blooming')
      playChime()
    }, 600)
    return () => clearTimeout(t)
  }, [])

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
            Someone grew {to ? to : 'you'} a garden
          </p>
        )}
      </div>

      <GardenScene
        flowers={flowers}
        autoBloom={phase === 'blooming'}
        onAllBloomed={handleAllBloomed}
        key="recipient"
      />

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
            A little garden, just for you.
          </p>
        ) : null}
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
            label={`You wrote this to ${previous.to || from || 'them'}`}
          />
        </div>
      )}

      <div className={`${styles.cta} ${msgVisible ? styles.visible : ''}`}>
        <p className={styles.ctaText}>Want to grow one back?</p>
        <a href={remixHref} className={styles.ctaBtn}>
          Grow {from ? `${from} a garden` : 'one back'}
        </a>
        <p className={styles.ctaSub}>
          or <a href={window.location.origin + window.location.pathname} className={styles.ctaSubLink}>start one for someone new</a>
        </p>
      </div>
    </div>
  )
}
