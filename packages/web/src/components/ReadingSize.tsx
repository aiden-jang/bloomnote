import { useState } from 'react'
import styles from './RecipientView.module.css'

export default function ReadingSize({ children }: { children: React.ReactNode }) {
  const [large, setLarge] = useState(() => {
    try {
      return localStorage.getItem('bloomnote.large-note') === '1'
    } catch {
      return false
    }
  })
  return (
    <div className={styles.readingNote} data-large={large}>
      <button
        type="button"
        className={styles.readingSize}
        aria-pressed={large}
        onClick={() => {
          setLarge(!large)
          try {
            localStorage.setItem('bloomnote.large-note', large ? '0' : '1')
          } catch {
            /* Reading size still works without preference storage. */
          }
        }}
      >
        Larger text
      </button>
      {children}
    </div>
  )
}
