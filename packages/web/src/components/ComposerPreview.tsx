import { useState } from 'react'
import BouquetNote from './BouquetNote'
import FlowerLegend from './FlowerLegend'
import { SecretEnvelope } from './SecretEnvelope'
import type { DesignResult } from '../lib/designGarden'
import { formatGardenDate } from '../lib/formatDate'
import styles from './Composer.module.css'

interface Props {
  garden: DesignResult
  shareUrl: string
  recipient: string
  from: string
  message: string
  secret: string
}

export default function ComposerPreview({ garden, shareUrl, recipient, from, message, secret }: Props) {
  const [previewSecretRevealed, setPreviewSecretRevealed] = useState(false)
  return (
    <>
      <p className={styles.previewLabel}>
        {recipient.trim() ? `what ${recipient.trim()} sees` : 'what they see'}
      </p>

      <a
        href={shareUrl}
        target="_blank"
        aria-describedby="external-link-hint"
        rel="noopener noreferrer"
        className={styles.fullRevealPreview}
      >
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
    </>
  )
}
