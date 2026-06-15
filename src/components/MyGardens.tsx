import { useState } from 'react'
import {
  loadSentGardens,
  removeSentGarden,
  type MineRecord,
} from '../lib/mine'
import { buildShareUrl } from '../garden'
import { labelFor as occasionLabel } from '../lib/occasions'
import { formatGardenDate } from '../lib/formatDate'
import styles from './MyGardens.module.css'

/**
 * The "/mine" archive view — a private outbox of gardens this device
 * has sent. Reads entirely from localStorage (see src/lib/mine.ts);
 * the server never knows who's looking, and there's no account.
 *
 * Each card carries enough to recognize the garden (recipient name,
 * occasion, date, a swatch row of its petal colors) and to act on it
 * (open the recipient view, copy the share link, or forget it locally).
 * Removing a card only forgets it here — the link keeps working for
 * anyone who already has it.
 *
 * Held in component state seeded once from storage. The only mutations
 * are local removals, so we update the array in place rather than
 * re-reading storage on every render.
 */
export default function MyGardens() {
  const [records, setRecords] = useState<MineRecord[]>(() => loadSentGardens())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopy = (id: string) => {
    void navigator.clipboard.writeText(buildShareUrl(id)).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(c => (c === id ? null : c)), 2000)
    })
  }

  const handleRemove = (id: string) => {
    removeSentGarden(id)
    setRecords(rs => rs.filter(r => r.id !== id))
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>your gardens</h1>
        <p className={styles.subtitle}>
          the gardens you&rsquo;ve grown, saved on this device.
        </p>
      </header>

      {records.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>you haven&rsquo;t grown any yet.</p>
          <a href="/" className={styles.emptyLink}>
            grow one
          </a>
        </div>
      ) : (
        <ul className={styles.list}>
          {records.map(r => (
            <GardenRow
              key={r.id}
              record={r}
              copied={copiedId === r.id}
              onCopy={() => handleCopy(r.id)}
              onRemove={() => handleRemove(r.id)}
            />
          ))}
        </ul>
      )}

      <footer className={styles.footer}>
        <a href="/" className={styles.backLink}>
          ← grow another
        </a>
      </footer>
    </div>
  )
}

interface RowProps {
  record: MineRecord
  copied: boolean
  onCopy: () => void
  onRemove: () => void
}

function GardenRow({ record, copied, onCopy, onRemove }: RowProps) {
  const { id, to, occasion, createdAt, unlockAt, swatches } = record

  // A capsule that hasn't opened yet shows a "sealed until" badge
  // instead of the plain grown-on date — same date the recipient is
  // waiting on.
  const sealedUntil =
    unlockAt && new Date(unlockAt).getTime() > Date.now()
      ? formatGardenDate(unlockAt)
      : null
  const grownOn = formatGardenDate(createdAt)

  const recipientLine = to.trim() ? `for ${to.trim()}` : 'for someone'

  return (
    <li className={styles.card}>
      <a href={`/g/${id}`} className={styles.cardMain}>
        <span className={styles.swatches} aria-hidden>
          {swatches.length > 0 ? (
            swatches.map((c, i) => (
              <span key={i} className={styles.swatch} style={{ background: c }} />
            ))
          ) : (
            <span className={styles.swatch} style={{ background: 'var(--green-pale)' }} />
          )}
        </span>
        <span className={styles.cardText}>
          <span className={styles.recipient}>{recipientLine}</span>
          <span className={styles.meta}>
            {occasion && <span>{occasionLabel(occasion)}</span>}
            {sealedUntil ? (
              <span className={styles.sealed}>opens {sealedUntil}</span>
            ) : (
              grownOn && <span>{grownOn}</span>
            )}
          </span>
        </span>
      </a>

      <div className={styles.cardActions}>
        <button type="button" className={styles.actionBtn} onClick={onCopy}>
          {copied ? 'copied' : 'copy link'}
        </button>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={onRemove}
          aria-label={`remove ${recipientLine} from your gardens`}
        >
          remove
        </button>
      </div>
    </li>
  )
}
