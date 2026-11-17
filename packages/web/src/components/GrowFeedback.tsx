import { occasionTone } from '../lib/occasions'
import type { ReactNode } from 'react'
import { useResultHeading } from '../lib/useResultHeading'
import { supportsViewTransition } from '../lib/viewTransition'
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
  const headingRef = useResultHeading()
  return (
    <div className={styles.designingPanel} data-result-entrance={!supportsViewTransition()}>
      <h2 className={styles.shareTitle} ref={headingRef} tabIndex={-1}>
        Growing<em> their garden.</em>
      </h2>
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
