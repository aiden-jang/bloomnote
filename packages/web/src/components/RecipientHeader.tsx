import type { RefObject } from 'react'
import styles from './RecipientView.module.css'

export default function RecipientHeader({
  from,
  to,
  headingRef,
  saved,
}: {
  from: string
  to: string | undefined
  headingRef: RefObject<HTMLHeadingElement>
  saved: boolean
}) {
  return (
    <div className={styles.topLabel}>
      {/* Opening removes its button; this heading keeps keyboard focus inside the garden. */}
      <h1 className={styles.fromText} tabIndex={-1} ref={headingRef}>
        Just for you{to ? ',' : '.'}
        {to && <em className={styles.recipientName}>{to}.</em>}
      </h1>
      {(from || saved) && (
        <div className={styles.headerDetails}>
          {from && <p className={styles.byline}>A little garden from {from}.</p>}
          {saved && (
            <a href="/mine?tab=received" className={styles.savedLink}>
              saved to your gardens
            </a>
          )}
        </div>
      )}
    </div>
  )
}
