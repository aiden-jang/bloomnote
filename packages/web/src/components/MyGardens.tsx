import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadSentGardens, removeSentGarden, type MineRecord } from '../lib/mine'
import { claimGardens, fetchMine, removeFromAccount, type GardenSummary } from '../lib/account'
import { buildShareUrl, fetchGarden, type GardenData } from '../garden'
import { saveGardenImage } from '../lib/gardenImage'
import { trackCardDownloaded } from '../lib/analytics'
import { labelFor as occasionLabel } from '../lib/occasions'
import { formatGardenDate } from '../lib/formatDate'
import styles from './MyGardens.module.css'

/**
 * The "/mine" view. Signed in, it reads server-side (so Sent + Received show on any device),
 * and on first visit it claims any gardens this device made anonymously. Signed out, it falls
 * back to the on-device archive (localStorage) — anonymous use still works, just per-device.
 */
type Tab = 'sent' | 'received'

// Undo toast (matches the recipient "saved" pill): a quiet cream chip pinned bottom-center.
const undoToastStyle: CSSProperties = {
  position: 'fixed',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 60,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '9px 10px 9px 16px',
  borderRadius: 999,
  background: 'rgba(250, 246, 238, 0.95)',
  border: '1px solid var(--green-pale, #e2e8dc)',
  backdropFilter: 'blur(6px)',
  WebkitBackdropFilter: 'blur(6px)',
  color: 'var(--color-ink-muted, #6b6963)',
  fontSize: '0.85rem',
  boxShadow: '0 6px 20px rgba(0, 0, 0, 0.08)',
}
const undoButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  font: 'inherit',
  fontWeight: 600,
  padding: '2px 8px',
  color: 'var(--color-accent, #c2549c)',
}

/** Fields GardenRow renders — satisfied by both MineRecord and the server GardenSummary. */
interface CardData {
  id: string
  to: string
  occasion?: string | undefined
  createdAt: string
  unlockAt?: string | undefined
  swatches: string[]
}

export default function MyGardens() {
  const { user, loading } = useAuth()

  if (loading) return <Shell subtitle="">{null}</Shell>
  return user ? <AccountGardens /> : <LocalGardens />
}

// --- Signed in: server-backed Sent + Received -----------------------------

function AccountGardens() {
  const [sent, setSent] = useState<GardenSummary[]>([])
  const [received, setReceived] = useState<GardenSummary[]>([])
  // Open the tab named in ?tab= (the "saved to your gardens" link lands on Received); default Sent.
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'received'
      ? 'received'
      : 'sent',
  )
  const [busy, setBusy] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      // First-login claim: adopt any gardens this device made anonymously, then forget them locally.
      const localIds = loadSentGardens().map(r => r.id)
      if (localIds.length > 0) {
        await claimGardens(localIds)
        localIds.forEach(removeSentGarden)
      }
      const mine = await fetchMine().catch(() => ({ sent: [], received: [] }))
      if (cancelled) return
      setSent(mine.sent)
      setReceived(mine.received)
      setBusy(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCopy = (id: string) => {
    void navigator.clipboard.writeText(buildShareUrl(id)).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(c => (c === id ? null : c)), 2000)
    })
  }

  // Remove with a delayed commit so it can be undone: drop the row immediately, but only fire the
  // server DELETE after a grace window. Undo cancels the pending delete and restores the row in
  // place, so nothing was ever deleted. A second remove — or leaving the view — flushes the prior
  // pending one so its delete isn't lost.
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCommit = useRef<(() => void) | null>(null)
  const [pending, setPending] = useState<{ item: GardenSummary; list: Tab; index: number } | null>(null)

  const flushPending = () => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
    if (pendingCommit.current) {
      pendingCommit.current()
      pendingCommit.current = null
    }
  }

  const handleRemove = (id: string) => {
    flushPending() // commit any prior pending removal so it isn't dropped
    const si = sent.findIndex(g => g.id === id)
    const ri = si < 0 ? received.findIndex(g => g.id === id) : -1
    if (si >= 0) {
      const item = sent[si]!
      setSent(s => s.filter(g => g.id !== id))
      setPending({ item, list: 'sent', index: si })
    } else if (ri >= 0) {
      const item = received[ri]!
      setReceived(s => s.filter(g => g.id !== id))
      setPending({ item, list: 'received', index: ri })
    } else {
      return
    }
    pendingCommit.current = () => void removeFromAccount(id)
    undoTimer.current = setTimeout(() => {
      pendingCommit.current?.()
      pendingCommit.current = null
      undoTimer.current = null
      setPending(null)
    }, 6000)
  }

  const handleUndo = () => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current)
      undoTimer.current = null
    }
    pendingCommit.current = null
    if (!pending) return
    const { item, list, index } = pending
    const reinsert = (arr: GardenSummary[]) => {
      const next = [...arr]
      next.splice(Math.min(index, next.length), 0, item)
      return next
    }
    if (list === 'sent') setSent(reinsert)
    else setReceived(reinsert)
    setPending(null)
  }

  // Commit a still-pending removal if the view unmounts, honoring the user's intent.
  useEffect(() => () => flushPending(), [])

  const list = tab === 'sent' ? sent : received

  return (
    <Shell subtitle="the gardens you've grown and kept, on every device.">
      {pending && (
        <div style={undoToastStyle} role="status">
          <span>removed</span>
          <button type="button" onClick={handleUndo} style={undoButtonStyle}>
            undo
          </button>
        </div>
      )}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'sent'}
          className={tab === 'sent' ? styles.tabActive : styles.tab}
          onClick={() => setTab('sent')}
        >
          sent{sent.length ? ` (${sent.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'received'}
          className={tab === 'received' ? styles.tabActive : styles.tab}
          onClick={() => setTab('received')}
        >
          received{received.length ? ` (${received.length})` : ''}
        </button>
      </div>

      {busy ? (
        <p className={styles.emptyText}>loading…</p>
      ) : list.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {tab === 'sent'
              ? 'you haven’t grown any yet.'
              : 'gardens people grow you will show up here.'}
          </p>
          {tab === 'sent' && (
            <a href="/" className={styles.emptyLink}>
              grow one
            </a>
          )}
        </div>
      ) : (
        <ul className={styles.list}>
          {list.map(r => (
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
    </Shell>
  )
}

// --- Signed out: on-device archive (unchanged behavior) -------------------

function LocalGardens() {
  const { login } = useAuth()
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
    <Shell subtitle="the gardens you've grown, saved on this device.">
      {records.length > 0 && (
        <p className={styles.emptyText}>
          <button type="button" className={styles.emptyLink} onClick={() => login()}>
            sign in
          </button>{' '}
          to keep them across devices.
        </p>
      )}
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
    </Shell>
  )
}

function Shell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <h1 className={styles.title}>your gardens</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </header>
      {children}
      <footer className={styles.footer}>
        <a href="/" className={styles.backLink}>
          ← grow another
        </a>
      </footer>
    </div>
  )
}

interface RowProps {
  record: CardData
  copied: boolean
  onCopy: () => void
  onRemove?: () => void
}

function GardenRow({ record, copied, onCopy, onRemove }: RowProps) {
  const { id, to, occasion, createdAt, unlockAt, swatches } = record
  const [saving, setSaving] = useState(false)

  // The list summary only has color swatches, not full flower specs, so the garden must be fetched
  // before building its share image. Prefetch on interaction-intent (hover / focus / touch-down) and
  // cache the promise, so by tap time the data is usually ready — keeping the click-to-share gap
  // inside the mobile user-activation window that navigator.share requires.
  const gardenRef = useRef<Promise<GardenData | null> | null>(null)
  const prefetch = (): void => {
    if (gardenRef.current) return
    const p = fetchGarden(id)
    gardenRef.current = p
    // A failed prefetch shouldn't become an unhandled rejection or poison the cache — clear it so
    // an actual save re-fetches instead of re-awaiting a rejected promise.
    p.catch(() => {
      if (gardenRef.current === p) gardenRef.current = null
    })
  }
  const handleSaveImage = async (): Promise<void> => {
    if (saving) return
    setSaving(true)
    try {
      const data = await (gardenRef.current ?? (gardenRef.current = fetchGarden(id)))
      if (data?.flowers?.length) {
        await saveGardenImage({ flowers: data.flowers, from: data.from, to: data.to })
        trackCardDownloaded('mine', 'square')
      }
    } catch {
      // Transient fetch failure or a rare canvas/decode error — drop the cached fetch so the next
      // tap retries rather than re-awaiting the rejected promise.
      gardenRef.current = null
    } finally {
      setSaving(false)
    }
  }

  const sealedUntil =
    unlockAt && new Date(unlockAt).getTime() > Date.now() ? formatGardenDate(unlockAt) : null
  const grownOn = formatGardenDate(createdAt)
  const recipientLine = to.trim() ? `for ${to.trim()}` : 'for someone'

  return (
    <li className={styles.card}>
      <a href={`/g/${id}`} className={styles.cardMain}>
        <span className={styles.swatches} aria-hidden>
          {swatches.length > 0 ? (
            swatches.map((c, i) => <span key={i} className={styles.swatch} style={{ background: c }} />)
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
          className={styles.actionBtn}
          onClick={() => void handleSaveImage()}
          onPointerEnter={prefetch}
          onPointerDown={prefetch}
          onFocus={prefetch}
          disabled={saving}
        >
          {saving ? 'saving…' : 'save image'}
        </button>
        {onRemove && (
          <button
            type="button"
            className={styles.removeBtn}
            onClick={onRemove}
            aria-label={`remove ${recipientLine} from your gardens`}
          >
            remove
          </button>
        )}
      </div>
    </li>
  )
}
