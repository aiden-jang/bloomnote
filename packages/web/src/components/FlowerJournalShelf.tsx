import { useEffect, useState } from 'react'
import {
  FLOWER_JOURNAL_EVENT,
  loadFlowerJournal,
  removeFlowerJournalEntry,
  type FlowerJournalEntry,
} from '../lib/flowerJournal'
import styles from './FlowerJournalShelf.module.css'
import { Constellations } from './Constellations'
import { gardenRecap } from '../lib/gardenRecap'
import { isQuiet, QUIET_MODE_EVENT, toggleQuiet } from '../lib/quietMode'

export default function FlowerJournalShelf({ currentGardenId }: { currentGardenId: string }) {
  const [entries, setEntries] = useState<FlowerJournalEntry[]>(() => loadFlowerJournal())
  const [quiet, setQuietState] = useState(isQuiet)

  useEffect(() => {
    const refresh = (): void => setEntries(loadFlowerJournal())
    const syncQuiet = (): void => setQuietState(isQuiet())
    window.addEventListener(FLOWER_JOURNAL_EVENT, refresh)
    window.addEventListener('storage', refresh)
    window.addEventListener('storage', syncQuiet)
    window.addEventListener(QUIET_MODE_EVENT, syncQuiet)
    return () => {
      window.removeEventListener(FLOWER_JOURNAL_EVENT, refresh)
      window.removeEventListener('storage', refresh)
      window.removeEventListener('storage', syncQuiet)
      window.removeEventListener(QUIET_MODE_EVENT, syncQuiet)
    }
  }, [])

  if (entries.length === 0) return null

  // Describes subjects, never cadence, which is why quiet mode leaves it alone. See gardenRecap.ts.
  const recapLine = gardenRecap(entries).line

  return (
    <section className={styles.shelf} aria-labelledby="flower-journal-heading">
      <div className={styles.heading}>
        <span>
          <strong id="flower-journal-heading">my flower journal</strong>
          <small>kept only on this device</small>
        </span>
        {!quiet && <span className={styles.count}>{entries.length}</span>}
      </div>
      {recapLine && <p className={styles.recap}>{recapLine}</p>}
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
      {entries.length > 8 && (
        <p className={styles.more}>
          {quiet ? 'more flowers are tucked away.' : `${entries.length - 8} more flowers are tucked away.`}
        </p>
      )}
      <Constellations entries={entries} />
      {/* Quiet mode's only control, and deliberately the plainest thing here: a prominent toggle would
          make the numbers read as the default you opt out of, and the default is the other way round. */}
      <button
        type="button"
        className={styles.quietToggle}
        aria-pressed={quiet}
        onClick={() => setQuietState(toggleQuiet())}
      >
        {quiet ? 'show the tallies' : 'hide the tallies'}
      </button>
    </section>
  )
}
