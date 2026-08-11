import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadSentGardens, removeSentGarden, type MineRecord } from '../lib/mine'
import { claimGardens, fetchMine, removeFromAccount, type GardenSummary } from '../lib/account'
import { buildShareUrl, fetchGarden, type GardenData } from '../garden'
import { saveGardenImage } from '../lib/gardenImage'
import { trackCardDownloaded, trackGardenReshared } from '../lib/analytics'
import { fetchWatersBatch, watersLabel } from '../lib/water'
import { labelFor as occasionLabel } from '../lib/occasions'
import { formatGardenDate } from '../lib/formatDate'
import styles from './MyGardens.module.css'

/**
 * The "/mine" view. Signed in, it reads server-side (so Sent + Received show on any device),
 * and on first visit it claims any gardens this device made anonymously. Signed out, it falls
 * back to the on-device archive (localStorage) — anonymous use still works, just per-device.
 */
type Tab = 'sent' | 'received'
type GardenSort = 'newest' | 'oldest' | 'watered'
const PINNED_STORAGE_KEY = 'bloomnote:pinned-gardens'

function readPinnedGardens(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(PINNED_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writePinnedGardens(ids: string[]): void {
  try {
    window.localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Pinning is an on-device convenience; storage failures never block the archive.
  }
}

function orderGardens<T extends CardData>(gardens: T[], pinned: string[], sort: GardenSort, waters: Record<string, number>): T[] {
  const ids = new Set(pinned)
  return [...gardens].sort((a, b) => {
    const pinOrder = Number(ids.has(b.id)) - Number(ids.has(a.id))
    if (pinOrder) return pinOrder
    if (sort === 'watered') {
      const waterOrder = (waters[b.id] ?? 0) - (waters[a.id] ?? 0)
      if (waterOrder) return waterOrder
    }
    const aDate = new Date(a.receivedAt ?? a.createdAt).getTime()
    const bDate = new Date(b.receivedAt ?? b.createdAt).getTime()
    return sort === 'oldest' ? aDate - bDate : bDate - aDate
  })
}

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
  color: 'var(--color-accent, #4a7c3f)',
}

/** Fields GardenRow renders — satisfied by both MineRecord and the server GardenSummary. */
interface CardData {
  id: string
  from?: string | undefined
  to: string
  occasion?: string | undefined
  createdAt: string
  unlockAt?: string | undefined
  receivedAt?: string | undefined
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
  const [query, setQuery] = useState('')
  const [pinned, setPinned] = useState<string[]>(readPinnedGardens)
  const [sort, setSort] = useState<GardenSort>('newest')
  const [pinnedOnly, setPinnedOnly] = useState(false)

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

  // Remove with a delayed commit so it can be undone: drop the row immediately, but only fire the
  // server DELETE after a grace window. Undo cancels the pending delete and restores the row in
  // place, so nothing was ever deleted. A second remove — or leaving the view — flushes the prior
  // pending one so its delete isn't lost.
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCommit = useRef<(() => void) | null>(null)
  /*
   * Water counts for the visible list, in one request.
   *
   * Keyed off the ids rather than the tab so switching back and forth doesn't refetch, and so a
   * garden removed from the list stops being asked about. Failures resolve to {} inside
   * fetchWatersBatch, so a slow or broken lookup costs the counts and nothing else.
   */
  const [waters, setWaters] = useState<Record<string, number>>({})
  const visibleIds = (tab === 'sent' ? sent : received).map(g => g.id)
  const idKey = visibleIds.join(',')
  useEffect(() => {
    if (!idKey) return
    let cancelled = false
    void fetchWatersBatch(idKey.split(',')).then(w => {
      if (!cancelled) setWaters(prev => ({ ...prev, ...w }))
    })
    return () => {
      cancelled = true
    }
  }, [idKey])

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
  const visiblePinned = list.filter(garden => pinned.includes(garden.id)).length
  const filtered = useMemo(() => {
    const scoped = pinnedOnly ? list.filter(garden => pinned.includes(garden.id)) : list
    return orderGardens(filterGardens(scoped, query), pinned, sort, waters)
  }, [list, query, pinned, pinnedOnly, sort, waters])
  const togglePinned = (id: string) => {
    setPinned(current => {
      const next = current.includes(id) ? current.filter(value => value !== id) : [id, ...current]
      writePinnedGardens(next)
      return next
    })
  }
  const switchTab = (nextTab: Tab) => {
    setTab(nextTab)
    // A search for a recipient should not make the other collection appear empty on arrival.
    setQuery('')
  }

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
          onClick={() => switchTab('sent')}
        >
          sent{sent.length ? ` (${sent.length})` : ''}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'received'}
          className={tab === 'received' ? styles.tabActive : styles.tab}
          onClick={() => switchTab('received')}
        >
          received{received.length ? ` (${received.length})` : ''}
        </button>
      </div>

      {list.length > 1 && (
        <div className={styles.libraryTools}>
        <select className={styles.sort} value={sort} onChange={event => setSort(event.target.value as GardenSort)} aria-label="Sort gardens">
          <option value="newest">newest first</option>
          <option value="oldest">oldest first</option>
          <option value="watered">most watered</option>
        </select>
        <label className={styles.search}>
          <span className={styles.srOnly}>Find a garden</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={tab === 'received' ? 'find someone’s garden' : 'find a garden'}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear garden search">
              clear
            </button>
          )}
        </label>
        {visiblePinned > 0 && (
          <button
            type="button"
            className={pinnedOnly ? `${styles.pinnedFilter} ${styles.pinnedFilterOn}` : styles.pinnedFilter}
            aria-pressed={pinnedOnly}
            onClick={() => setPinnedOnly(value => !value)}
          >
            ★ pinned ({visiblePinned})
          </button>
        )}
        </div>
      )}

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
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>{pinnedOnly ? 'no pinned gardens here yet.' : `no gardens match “${query.trim()}”.`}</p>
          <button type="button" className={styles.emptyLink} onClick={() => { setQuery(''); setPinnedOnly(false) }}>
            show them all
          </button>
        </div>
      ) : (
        <ul className={styles.list}>
          {filtered.map(r => (
            <GardenRow
              key={r.id}
              record={r}
              kind={tab}
              waters={waters[r.id] ?? 0}
              pinned={pinned.includes(r.id)}
              onPin={() => togglePinned(r.id)}
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
  const [query, setQuery] = useState('')
  const [pinned, setPinned] = useState<string[]>(readPinnedGardens)
  const [sort, setSort] = useState<GardenSort>('newest')
  const [pinnedOnly, setPinnedOnly] = useState(false)
  // Same one-request lookup as the signed-in list. This is the case that matters most: bloomnote is
  // anonymous-first, so the sender who never makes an account is the usual sender, and without this
  // they only ever learn a garden was watered by reopening that exact link.
  const [waters, setWaters] = useState<Record<string, number>>({})
  const idKey = records.map(r => r.id).join(',')
  useEffect(() => {
    if (!idKey) return
    let cancelled = false
    void fetchWatersBatch(idKey.split(',')).then(w => {
      if (!cancelled) setWaters(prev => ({ ...prev, ...w }))
    })
    return () => {
      cancelled = true
    }
  }, [idKey])

  const handleRemove = (id: string) => {
    removeSentGarden(id)
    setRecords(rs => rs.filter(r => r.id !== id))
  }
  const visiblePinned = records.filter(record => pinned.includes(record.id)).length
  const filtered = useMemo(() => {
    const scoped = pinnedOnly ? records.filter(record => pinned.includes(record.id)) : records
    return orderGardens(filterGardens(scoped, query), pinned, sort, waters)
  }, [records, query, pinned, pinnedOnly, sort, waters])
  const togglePinned = (id: string) => {
    setPinned(current => {
      const next = current.includes(id) ? current.filter(value => value !== id) : [id, ...current]
      writePinnedGardens(next)
      return next
    })
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
        <>
          {records.length > 1 && (
            <div className={styles.libraryTools}>
            <select className={styles.sort} value={sort} onChange={event => setSort(event.target.value as GardenSort)} aria-label="Sort gardens">
              <option value="newest">newest first</option>
              <option value="oldest">oldest first</option>
              <option value="watered">most watered</option>
            </select>
            <label className={styles.search}>
              <span className={styles.srOnly}>Find a garden</span>
              <input
                type="search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="find a garden"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear garden search">
                  clear
                </button>
              )}
            </label>
            {visiblePinned > 0 && (
              <button
                type="button"
                className={pinnedOnly ? `${styles.pinnedFilter} ${styles.pinnedFilterOn}` : styles.pinnedFilter}
                aria-pressed={pinnedOnly}
                onClick={() => setPinnedOnly(value => !value)}
              >
                ★ pinned ({visiblePinned})
              </button>
            )}
            </div>
          )}
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>{pinnedOnly ? 'no pinned gardens here yet.' : `no gardens match “${query.trim()}”.`}</p>
              <button type="button" className={styles.emptyLink} onClick={() => { setQuery(''); setPinnedOnly(false) }}>
                show them all
              </button>
            </div>
          ) : (
        <ul className={styles.list}>
          {filtered.map(r => (
            <GardenRow
              key={r.id}
              record={r}
              kind="sent"
              waters={waters[r.id] ?? 0}
              pinned={pinned.includes(r.id)}
              onPin={() => togglePinned(r.id)}
              onRemove={() => handleRemove(r.id)}
            />
          ))}
        </ul>
          )}
        </>
      )}
    </Shell>
  )
}

/** Search what people remember: who it was for, who it came from, or the occasion. */
function filterGardens<T extends CardData>(gardens: T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase()
  if (!needle) return gardens
  return gardens.filter(garden =>
    [garden.from, garden.to, garden.occasion]
      .filter((part): part is string => typeof part === 'string')
      .some(part => part.toLocaleLowerCase().includes(needle)),
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
  /** A received garden is someone else's gift, so its label should lead with them—not its original recipient. */
  kind: Tab
  /** How many times this garden has been watered. Omitted or 0 means the row says nothing. */
  waters?: number
  pinned?: boolean
  onPin?: () => void
  onRemove?: () => void
}

function GardenRow({ record, kind, waters = 0, pinned = false, onPin, onRemove }: RowProps) {
  const { id, from, to, occasion, createdAt, unlockAt, receivedAt, swatches } = record
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)

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
    if (imageStatus) return
    setImageStatus('saving')
    try {
      const data = await (gardenRef.current ?? (gardenRef.current = fetchGarden(id)))
      if (data?.flowers?.length) {
        const result = await saveGardenImage({ flowers: data.flowers, from: data.from, to: data.to })
        if (result === 'dismissed') {
          setImageStatus(null)
          return
        }
        setImageStatus(result)
        if (result === 'downloaded') trackCardDownloaded('mine', 'square')
        window.setTimeout(() => setImageStatus(null), 2500)
      } else {
        setImageStatus(null)
      }
    } catch {
      // Transient fetch failure or a rare canvas/decode error — drop the cached fetch so the next
      // tap retries rather than re-awaiting the rejected promise.
      gardenRef.current = null
      setImageStatus(null)
    }
  }

  const handleShare = async (): Promise<void> => {
    if (shareStatus) return
    setShareStatus('sharing')
    const url = buildShareUrl(id)
    const shareData: ShareData = {
      title: 'bloomnote',
      text: kind === 'received' && from ? `A garden from ${from}` : to.trim() ? `A garden for ${to.trim()}` : 'A garden for you',
      url,
    }
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share(shareData)
        setShareStatus('shared')
        trackGardenReshared('native')
      } else {
        await navigator.clipboard.writeText(url)
        setShareStatus('copied')
        trackGardenReshared('copy')
      }
      window.setTimeout(() => setShareStatus(null), 2500)
    } catch (err) {
      setShareStatus(null)
      if (err instanceof Error && err.name === 'AbortError') return
    }
  }

  const sealedUntil =
    unlockAt && new Date(unlockAt).getTime() > Date.now() ? formatGardenDate(unlockAt) : null
  const grownOn = formatGardenDate(createdAt)
  const keptOn = receivedAt ? formatGardenDate(receivedAt) : null
  const recipientLine = to.trim() ? `for ${to.trim()}` : 'for someone'
  const receivedLine = from?.trim() ? `from ${from.trim()}` : 'a garden for you'
  const cardLabel = kind === 'received' ? receivedLine : recipientLine

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
          <span className={styles.recipient}>{cardLabel}</span>
          <span className={styles.meta}>
            {occasion && <span>{occasionLabel(occasion)}</span>}
            {sealedUntil ? (
              <span className={styles.sealed}>opens {sealedUntil}</span>
            ) : (
              (kind === 'received' ? keptOn ?? grownOn : grownOn) && (
                <span>{kind === 'received' && keptOn ? `kept ${keptOn}` : grownOn}</span>
              )
            )}
            {/* The only thing on this page that came back from the other person. Shown only when
                somebody actually watered it — a "watered 0 times" on every card would bury the ones
                that mean something. */}
            {waters > 0 && <span className={styles.watered}>{watersLabel(waters)}</span>}
          </span>
        </span>
      </a>

      <div className={styles.cardActions}>
        {onPin && (
          <button
            type="button"
            className={pinned ? `${styles.pinBtn} ${styles.pinBtnOn}` : styles.pinBtn}
            onClick={onPin}
            aria-pressed={pinned}
            aria-label={`${pinned ? 'Unpin' : 'Pin'} garden ${cardLabel}`}
          >
            {pinned ? '★ pinned' : '☆ pin'}
          </button>
        )}
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => void handleShare()}
          disabled={shareStatus !== null}
          aria-label={`Share garden ${cardLabel}`}
        >
          {shareStatus === 'sharing'
            ? 'opening…'
            : shareStatus === 'shared'
              ? 'shared'
              : shareStatus === 'copied'
                ? 'copied'
                : 'share'}
        </button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={() => void handleSaveImage()}
          onPointerEnter={prefetch}
          onPointerDown={prefetch}
          onFocus={prefetch}
          disabled={imageStatus !== null}
        >
          {imageStatus === 'saving'
            ? 'making image…'
            : imageStatus === 'shared'
              ? 'image shared'
              : imageStatus === 'downloaded'
                ? 'image downloaded'
                : 'save image'}
        </button>
        {onRemove && (
          <button
            type="button"
            className={styles.removeBtn}
            onClick={onRemove}
            aria-label={`remove garden ${cardLabel} from your gardens`}
          >
            remove
          </button>
        )}
      </div>
    </li>
  )
}
