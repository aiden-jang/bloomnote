import { Spinner } from './ComposerBloom'
import styles from './Composer.module.css'

export default function GrowFeedback({ statusText, onCancel }: { statusText: string; onCancel: () => void }) {
  return (
    <div className={styles.designingPanel}>
      <div className={styles.designingRow} role="status" aria-live="polite">
        <Spinner />
        <span>{statusText || 'growing…'}</span>
      </div>
      <p className={styles.growingAside}>A small botanical overreaction.</p>
      <button className={styles.cancelBtn} onClick={onCancel}>
        cancel
      </button>
    </div>
  )
}
