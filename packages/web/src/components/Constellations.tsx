import { useMemo, useState } from 'react'
import { constellationLine, constellations, type Constellation } from '../lib/constellations'
import type { FlowerJournalEntry } from '../lib/flowerJournal'
import styles from './Constellations.module.css'

const KIND_MARK: Record<Constellation['kind'], string> = {
  person: '✽',
  place: '⌖',
  feeling: '❍',
}

export function Constellations({ entries }: { entries: FlowerJournalEntry[] }) {
  const threads = useMemo(() => constellations(entries), [entries])
  const [open, setOpen] = useState<string | null>(null)

  if (threads.length === 0) return null

  const active = threads.find((t) => `${t.kind}:${t.key}` === open) ?? null
  const linked = active
    ? active.entryIds
        .map((id) => entries.find((e) => e.id === id))
        .filter((e): e is FlowerJournalEntry => !!e)
    : []

  return (
    <section className={styles.wrap} aria-labelledby="constellations-heading">
      <div className={styles.heading}>
        <strong id="constellations-heading">what keeps coming back</strong>
        <small>found on this device, from what you wrote</small>
      </div>

      <ul className={styles.threads}>
        {threads.slice(0, 10).map((thread) => {
          const id = `${thread.kind}:${thread.key}`
          const isOpen = open === id
          return (
            <li key={id}>
              <button
                type="button"
                className={styles.thread}
                aria-expanded={isOpen}
                aria-controls="constellation-detail"
                onClick={() => setOpen(isOpen ? null : id)}
              >
                <span className={styles.kind} aria-hidden>
                  {KIND_MARK[thread.kind]}
                </span>
                {thread.label}
                <span className={styles.times}>{thread.entryCount}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {active && (
        <div className={styles.detail} id="constellation-detail">
          <p>{constellationLine(active)}</p>
          <ul>
            {linked.map((entry) => (
              <li key={entry.id}>
                <a href={`/g/${entry.gardenId}`}>{entry.flowerName}</a>
                {entry.memory && <em>“{entry.memory}”</em>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
