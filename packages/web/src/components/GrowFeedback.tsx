import { occasionTone } from '../lib/occasions'
import type { ReactNode } from 'react'
import { Spinner } from './ComposerBloom'
import styles from './GardenResult.module.css'

export default function GrowFeedback({
  occasion,
  statusText,
  onCancel,
  scene,
  message,
}: {
  occasion: string
  statusText: string
  onCancel: () => void
  scene: ReactNode
  message: string
}) {
  return (
    <div className={styles.designingPanel}>
      <h2 className={styles.shareTitle}>Growing their garden.</h2>
      <div className={styles.designingRow} role="status" aria-live="polite">
        <Spinner />
        <span>{statusText || 'choosing flowers…'}</span>
      </div>
      <div className={styles.garden}>{scene}</div>
      <p className={styles.growingAside}>
        {occasionTone(occasion) === 'ordinary'
          ? 'A small botanical overreaction.'
          : 'Choosing flowers for your note.'}
      </p>
      <button className={styles.cancelBtn} onClick={onCancel}>
        cancel
      </button>
      <blockquote className={styles.growingNote}>{message}</blockquote>
    </div>
  )
}
