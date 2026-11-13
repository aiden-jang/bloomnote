import type { ReactNode } from 'react'
import { Spinner } from './ComposerBloom'
import styles from './GardenResult.module.css'

export default function GrowFeedback({
  statusText,
  onCancel,
  scene,
  message,
}: {
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
        <span>{statusText || 'growing…'}</span>
      </div>
      <div className={styles.garden}>{scene}</div>
      <p className={styles.growingAside}>A small botanical overreaction.</p>
      <button className={styles.cancelBtn} onClick={onCancel}>
        cancel
      </button>
      <blockquote className={styles.growingNote}>{message}</blockquote>
    </div>
  )
}
