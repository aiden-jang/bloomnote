import type { RefObject } from 'react'
import BloomBrand from './BloomBrand'
import styles from './RecipientView.module.css'

export default function RecipientHeader({
  from,
  to,
  headingRef,
}: {
  from: string
  to: string | undefined
  headingRef: RefObject<HTMLHeadingElement>
}) {
  return (
    <div className={styles.topLabel}>
      <BloomBrand />
      {/* Opening removes its button; this heading keeps keyboard focus inside the garden. */}
      <h1 className={styles.fromText} tabIndex={-1} ref={headingRef}>
        {from ? (
          <>
            <span className={styles.fromName}>{from}</span> grew {to || 'you'} a garden
          </>
        ) : (
          <>someone grew {to || 'you'} a garden</>
        )}
      </h1>
    </div>
  )
}
