import GardenScene from './GardenScene'
import Shell from './GardenLibraryShell'
import GardenRow from './GardenRow'
import LibraryTabs from './LibraryTabs'
import { GardenImpactCard, MemoryLane } from './GardenLibraryHighlights'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { loadSentGardens, removeSentGarden, type MineRecord } from '../lib/mine'
import { useAccountGardens } from '../lib/useAccountGardens'
import { useGardenLibrary, type GardenLibrary } from '../lib/useGardenLibrary'
import { useGardenResponses } from '../lib/useGardenResponses'
import styles from './MyGardens.module.css'
import type { CardData, GardenSort, Tab } from '../lib/gardenList'

export default function MyGardens() {
  const { user, loading } = useAuth()

  if (loading)
    return (
      <Shell subtitle="">
        <p className={styles.emptyText} role="status">
          checking your sign-in…
        </p>
      </Shell>
    )
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
  const {
    sent,
    received,
    busy,
    loadError,
    pending,
    removalError,
    remove,
    undo,
    retryLoad,
    dismissRemovalError,
  } = useAccountGardens()
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tab') === 'received'
      ? 'received'
      : 'sent',
  )
  const list = tab === 'sent' ? sent : received
  const { waters, feelings } = useGardenResponses(list.map((g) => g.id))
  const library = useGardenLibrary(list, waters)
  const { query, setQuery, pinnedOnly, setPinnedOnly, pinned, togglePinned, filtered } = library

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
        <div className={styles.undoToast} role="status">
          <span>removed</span>
          <button type="button" onClick={undo} className={styles.undoButton}>
            undo
          </button>
        </div>
      )}
      {removalError && (
        <div className={styles.notice} role="alert">
          <p>couldn’t remove that garden. It’s back in your library. Try removing it again.</p>
          <button type="button" className={styles.emptyLink} onClick={dismissRemovalError}>
            dismiss
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
            <button type="button" className={styles.emptyLink} onClick={retryLoad}>
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
                onRemove={() => remove(r.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </Shell>
  )
}

function LocalGardens() {
  const { login, sessionError, retrySession } = useAuth()
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
      {sessionError && (
        <div className={styles.notice} role="alert">
          <p>couldn’t check your sign-in. Only the gardens saved on this device are shown.</p>
          <button type="button" className={styles.emptyLink} onClick={() => void retrySession()}>
            try again
          </button>
        </div>
      )}
      {!sessionError && records.length > 0 && (
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
