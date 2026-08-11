import { useEffect, useState } from 'react'
import {
  FLOWER_JOURNAL_EVENT,
  loadFlowerJournal,
  removeFlowerJournalEntry,
  type FlowerJournalEntry,
} from '../lib/flowerJournal'
import styles from './FlowerJournalShelf.module.css'

export default function FlowerJournalShelf({ currentGardenId }: { currentGardenId: string }) {
  const [entries, setEntries] = useState<FlowerJournalEntry[]>(() => loadFlowerJournal())

  useEffect(() => {
    const refresh = (): void => setEntries(loadFlowerJournal())
    window.addEventListener(FLOWER_JOURNAL_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(FLOWER_JOURNAL_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if (entries.length === 0) return null

  return (
    <section className={styles.shelf} aria-labelledby="flower-journal-heading">
      <div className={styles.heading}>
        <span>
          <strong id="flower-journal-heading">my flower journal</strong>
          <small>kept only on this device</small>
        </span>
        <span className={styles.count}>{entries.length}</span>
      </div>
      <ul className={styles.entries}>
        {entries.slice(0, 8).map(entry => (
          <li key={entry.id} className={entry.gardenId === currentGardenId ? styles.current : undefined}>
            <span className={styles.swatches} aria-hidden>
              {entry.colors.slice(0, 3).map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
            </span>
            <span className={styles.copy}>
              <a href={`/g/${entry.gardenId}`}>{entry.flowerName}</a>
              <small>{entry.from ? `from ${entry.from}` : 'from a bloomnote'}</small>
              {entry.memory && <em>“{entry.memory}”</em>}
            </span>
            <button
              type="button"
              onClick={() => removeFlowerJournalEntry(entry.id)}
              aria-label={`Remove ${entry.flowerName} from flower journal`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {entries.length > 8 && <p className={styles.more}>{entries.length - 8} more flowers are tucked away.</p>}
    </section>
  )
}
