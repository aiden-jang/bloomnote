import GardenScene from './GardenScene'
import Shell from './GardenLibraryShell'
import GardenRow from './GardenRow'
import { FlowerHead } from './FlowerSVG'
import { cardBloom } from '../lib/cardBloom'
import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadSentGardens, removeSentGarden, type MineRecord } from '../lib/mine'
import { claimGardens, fetchMine, removeFromAccount, type GardenSummary } from '../lib/account'
import type { Feeling } from '../lib/water'
import { formatGardenDate } from '../lib/formatDate'
import { gardenMemoryDeck, gardenMemoryLabel } from '../lib/gardenMemories'
import { gardenImpact } from '../lib/gardenImpact'
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

/* One component for both archives. It was two copies, which is the shape where a fix lands on the
   signed-in list and quietly misses the signed-out one. */
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const localIds = loadSentGardens().map((r) => r.id)
      if (localIds.length > 0) {
        const claimed = await claimGardens(localIds)
        if (claimed !== null) localIds.forEach(removeSentGarden)
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
        <LibraryTools
          library={library as GardenLibrary<CardData>}
          searchPlaceholder={tab === 'received' ? 'find someone’s garden' : 'find a garden'}
        />
      )}

      {!busy && <MemoryLane gardens={list} kind={tab} />}
      {!busy && tab === 'sent' && <GardenImpactCard gardens={sent} waters={waters} feelings={feelings} />}

      {busy ? (
        <p className={styles.emptyText}>loading…</p>
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

const feelingCopy: Record<Feeling, { emoji: string; noun: string }> = {
  love: { emoji: '♡', noun: 'love' },
  comfort: { emoji: '☁', noun: 'comfort' },
  joy: { emoji: '✦', noun: 'joy' },
  hug: { emoji: 'ʕっ•ᴥ•ʔっ', noun: 'hugs' },
}

function GardenImpactCard({
  gardens,
  waters,
  feelings,
}: {
  gardens: CardData[]
  waters: Record<string, number>
  feelings: Record<string, Partial<Record<Feeling, number>>>
}) {
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)
  const impact = useMemo(
    () =>
      gardenImpact(
        gardens.map((garden) => garden.id),
        Object.fromEntries(
          gardens.map((garden) => [
            garden.id,
            {
              waters: waters[garden.id] ?? 0,
              feelings: feelings[garden.id] ?? {},
            },
          ]),
        ),
      ),
    [gardens, waters, feelings],
  )

  if (impact.respondedGardens === 0) return null
  const strongest = impact.strongestFeeling ? feelingCopy[impact.strongestFeeling.feeling] : null
  const favorite = gardens.find((garden) => garden.id === impact.mostWateredId)
  const favoriteName = favorite?.to.trim()

  const shareImpact = async (): Promise<void> => {
    if (shareStatus) return
    const feelingLine = strongest
      ? `
Most felt: ${strongest.emoji} ${strongest.noun}`
      : ''
    const text = `My bloomnotes came back to me 🌱
${impact.totalWaters} ${impact.totalWaters === 1 ? 'water' : 'waters'} · ${impact.totalFeelings} ${impact.totalFeelings === 1 ? 'feeling' : 'feelings'} across ${impact.respondedGardens} ${impact.respondedGardens === 1 ? 'garden' : 'gardens'}${feelingLine}`
    const finish = (status: 'shared' | 'copied') => {
      setShareStatus(status)
      window.setTimeout(() => setShareStatus(null), 2200)
    }
    setShareStatus('sharing')
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'what came back from my bloomnotes',
          text,
          url: window.location.origin,
        })
        finish('shared')
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setShareStatus(null)
          return
        }
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${window.location.origin}`)
      finish('copied')
    } catch {
      setShareStatus(null)
    }
  }

  return (
    <aside className={styles.impact} aria-label="What came back from your gardens">
      <div className={styles.impactHeading}>
        <span>
          <span className={styles.impactEyebrow}>what came back</span>
          <strong>your gardens reached people.</strong>
        </span>
        <span className={styles.impactSprout} aria-hidden>
          ❀
        </span>
      </div>
      <div className={styles.impactStats}>
        <span>
          <strong>{impact.totalWaters}</strong>
          <small>{impact.totalWaters === 1 ? 'water' : 'waters'}</small>
        </span>
        <span>
          <strong>{impact.totalFeelings}</strong>
          <small>{impact.totalFeelings === 1 ? 'feeling' : 'feelings'}</small>
        </span>
        <span>
          <strong>{impact.respondedGardens}</strong>
          <small>reached back</small>
        </span>
      </div>
      {(strongest || favoriteName) && (
        <p className={styles.impactNote}>
          {strongest && (
            <span>
              most felt: {strongest.emoji} {strongest.noun}
            </span>
          )}
          {strongest && favoriteName && <span aria-hidden> · </span>}
          {favoriteName && <span>most watered: the one for {favoriteName}</span>}
        </p>
      )}
      <button
        type="button"
        className={styles.impactShare}
        onClick={() => void shareImpact()}
        disabled={shareStatus !== null}
      >
        {shareStatus === 'sharing'
          ? 'opening…'
          : shareStatus === 'shared'
            ? 'shared'
            : shareStatus === 'copied'
              ? 'copied'
              : 'share this little recap'}
      </button>
    </aside>
  )
}

function MemoryLane({ gardens, kind }: { gardens: CardData[]; kind: Tab }) {
  const [memoryIndex, setMemoryIndex] = useState(0)
  // Freeze "today" for this visit. Changing the card while somebody is looking at it would be a
  // stranger kind of accuracy than a midnight rollover waiting for the next page open.
  const [today] = useState(() => new Date())
  const memories = useMemo(() => gardenMemoryDeck(gardens, today), [gardens, today])

  useEffect(() => setMemoryIndex(0), [kind])

  if (memories.length === 0) return null
  const memory = memories[memoryIndex % memories.length]!
  const name = kind === 'received' ? memory.from?.trim() : memory.to.trim()
  const memoryAt = memory.receivedAt ?? memory.createdAt
  const date = formatGardenDate(memoryAt)
  const age = gardenMemoryLabel(memoryAt, today)

  return (
    <aside className={styles.memoryLane} aria-label="A garden to revisit">
      <a href={`/g/${memory.id}`} className={styles.memoryMain}>
        <span className={styles.memoryBouquet} aria-hidden>
          {(memory.swatches.length ? memory.swatches : ['#cbd6c2']).slice(0, 5).map((color, index) => (
            <span key={`${color}-${index}`}>
              <FlowerHead flower={cardBloom(color, memory.id, index)} size={22} />
            </span>
          ))}
        </span>
        <span className={styles.memoryCopy}>
          <span className={styles.memoryEyebrow}>{age || 'from the garden path'}</span>
          <strong>
            {kind === 'received'
              ? `a garden ${name ? `from ${name}` : 'you kept'}`
              : `the one ${name ? `for ${name}` : 'you grew'}`}
          </strong>
          {date && <small>{date}</small>}
        </span>
        <span className={styles.memoryOpen} aria-hidden>
          open →
        </span>
      </a>
      {memories.length > 1 && (
        <button
          type="button"
          className={styles.memoryNext}
          onClick={() => setMemoryIndex((index) => (index + 1) % memories.length)}
          aria-label="Show another garden memory"
        >
          another
        </button>
      )}
    </aside>
  )
}
