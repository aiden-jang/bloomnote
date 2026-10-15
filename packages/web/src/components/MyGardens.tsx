import GardenScene from './GardenScene'
import Shell from './GardenLibraryShell'
import GardenRow from './GardenRow'
import LibraryTabs from './LibraryTabs'
import { GardenImpactCard, MemoryLane } from './GardenLibraryHighlights'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadSentGardens, removeSentGarden, type MineRecord } from '../lib/mine'
import { claimGardens, fetchMine, removeFromAccount, type GardenSummary } from '../lib/account'
import { useGardenLibrary, type GardenLibrary } from '../lib/useGardenLibrary'
import { useGardenResponses } from '../lib/useGardenResponses'
import styles from './MyGardens.module.css'
import type { CardData, GardenSort, Tab } from '../lib/gardenList'

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

export default function MyGardens() {
  const { user, loading } = useAuth()

  if (loading) return <Shell subtitle="">{null}</Shell>
  return user ? <AccountGardens /> : <LocalGardens />
}

// Both archives share filtering, ordering, and pin controls.
function LibraryTools({
  library,
  searchPlaceholder,
}: {
  library: GardenLibrary<CardData>
  searchPlaceholder: string
}) {
  const { query, setQuery, sort, setSort, pinnedOnly, setPinnedOnly, visiblePinned } = library
  return (
    <div className={styles.libraryTools}>
      <select
        className={styles.sort}
        value={sort}
        onChange={(event) => setSort(event.target.value as GardenSort)}
        aria-label="Sort gardens"
      >
        <option value="newest">newest first</option>
        <option value="oldest">oldest first</option>
        <option value="watered">most watered</option>
      </select>
      <label className={styles.search}>
        <span className={styles.srOnly}>Find a garden</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
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
          onClick={() => setPinnedOnly((value) => !value)}
        >
          ★ pinned ({visiblePinned})
        </button>
      )}
    </div>
  )
}

function AccountGardens() {
  const [sent, setSent] = useState<GardenSummary[]>([])
  const [received, setReceived] = useState<GardenSummary[]>([])
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'received'
      ? 'received'
      : 'sent',
  )
  const [busy, setBusy] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setBusy(true)
      setLoadError(false)
      const localIds = loadSentGardens().map((r) => r.id)
      if (localIds.length > 0) {
        const claimed = await claimGardens(localIds)
        if (claimed !== null) localIds.forEach(removeSentGarden)
      }
      try {
        const mine = await fetchMine()
        if (cancelled) return
        setSent(mine.sent)
        setReceived(mine.received)
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [retry])

  // Delayed commit so a removal can be undone: drop the row now, fire the server DELETE after a
  // grace window. Undo cancels the pending delete, so nothing was ever deleted.
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCommit = useRef<(() => void) | null>(null)
  const list = tab === 'sent' ? sent : received
  const { waters, feelings } = useGardenResponses(list.map((g) => g.id))
  const library = useGardenLibrary(list, waters)
  const { query, setQuery, pinnedOnly, setPinnedOnly, pinned, togglePinned, filtered } = library

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
    flushPending()
    const si = sent.findIndex((g) => g.id === id)
    const ri = si < 0 ? received.findIndex((g) => g.id === id) : -1
    if (si >= 0) {
      const item = sent[si]!
      setSent((s) => s.filter((g) => g.id !== id))
      setPending({ item, list: 'sent', index: si })
    } else if (ri >= 0) {
      const item = received[ri]!
      setReceived((s) => s.filter((g) => g.id !== id))
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

  // Commit a still-pending removal if the view unmounts, honouring the user's intent.
  useEffect(() => () => flushPending(), [])

  const switchTab = (nextTab: Tab) => {
    setTab(nextTab)
    const url = new URL(location.href)
    if (nextTab === 'received') url.searchParams.set('tab', 'received')
    else url.searchParams.delete('tab')
    history.replaceState(history.state, '', url)
    // A search for a recipient must not make the other collection look empty on arrival.
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
      <LibraryTabs tab={tab} sent={sent.length} received={received.length} onChange={switchTab} />
      <section role="tabpanel" id="garden-collection" aria-labelledby={`garden-tab-${tab}`}>
        {list.length > 1 && (
          <LibraryTools
            library={library as GardenLibrary<CardData>}
            searchPlaceholder={tab === 'received' ? 'find someone’s garden' : 'find a garden'}
          />
        )}

        {!busy && !loadError && <MemoryLane gardens={list} kind={tab} />}
        {!busy && !loadError && tab === 'sent' && (
          <GardenImpactCard gardens={sent} waters={waters} feelings={feelings} />
        )}

        {busy ? (
          <p className={styles.emptyText} role="status">
            loading…
          </p>
        ) : loadError ? (
          <div className={styles.empty} role="alert">
            <p className={styles.emptyText}>couldn’t load your gardens. Your saved links are still there.</p>
            <button type="button" className={styles.emptyLink} onClick={() => setRetry((n) => n + 1)}>
              try again
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {tab === 'sent' ? 'you haven’t grown any yet.' : 'gardens people grow you will show up here.'}
            </p>
            {tab === 'sent' && (
              <a href="/" className={styles.emptyLink}>
                grow one
              </a>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>
              {pinnedOnly ? 'no pinned gardens here yet.' : `no gardens match “${query.trim()}”.`}
            </p>
            <button
              type="button"
              className={styles.emptyLink}
              onClick={() => {
                setQuery('')
                setPinnedOnly(false)
              }}
            >
              show them all
            </button>
          </div>
        ) : (
          <ul className={styles.list}>
            {filtered.map((r) => (
              <GardenRow
                key={r.id}
                record={r}
                kind={tab}
                waters={waters[r.id] ?? 0}
                feelings={feelings[r.id] ?? {}}
                pinned={pinned.includes(r.id)}
                onPin={() => togglePinned(r.id)}
                onRemove={() => handleRemove(r.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </Shell>
  )
}

function LocalGardens() {
  const { login } = useAuth()
  const [records, setRecords] = useState<MineRecord[]>(() => loadSentGardens())
  const { waters, feelings } = useGardenResponses(records.map((r) => r.id))
  const library = useGardenLibrary(records, waters)
  const { query, setQuery, pinnedOnly, setPinnedOnly, pinned, togglePinned, filtered } = library

  const handleRemove = (id: string) => {
    removeSentGarden(id)
    setRecords((rs) => rs.filter((r) => r.id !== id))
  }

  return (
    <Shell subtitle="the gardens you've grown, saved on this device." hideBackLink={records.length === 0}>
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
          <div className={styles.emptyPlot}>
            <GardenScene flowers={[]} autoBloom={false} silent draftGrowth={2} />
          </div>
          <p className={styles.emptyText}>Nothing growing yet. Very low maintenance.</p>
          <a href="/" className={styles.emptyLink}>
            grow one
          </a>
        </div>
      ) : (
        <>
          {records.length > 1 && (
            <LibraryTools library={library as GardenLibrary<CardData>} searchPlaceholder="find a garden" />
          )}
          <MemoryLane gardens={records} kind="sent" />
          <GardenImpactCard gardens={records} waters={waters} feelings={feelings} />
          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>
                {pinnedOnly ? 'no pinned gardens here yet.' : `no gardens match “${query.trim()}”.`}
              </p>
              <button
                type="button"
                className={styles.emptyLink}
                onClick={() => {
                  setQuery('')
                  setPinnedOnly(false)
                }}
              >
                show them all
              </button>
            </div>
          ) : (
            <ul className={styles.list}>
              {filtered.map((r) => (
                <GardenRow
                  key={r.id}
                  record={r}
                  kind="sent"
                  waters={waters[r.id] ?? 0}
                  feelings={feelings[r.id] ?? {}}
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
