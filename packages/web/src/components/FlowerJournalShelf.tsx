import { useEffect, useRef, useState } from 'react'
import {
  FLOWER_JOURNAL_EVENT,
  loadFlowerJournal,
  removeFlowerJournalEntry,
  setEntryMeaning,
  setEntryShelves,
  type FlowerJournalEntry,
} from '../lib/flowerJournal'
import { entriesOn, isOn, meaningOf, SHELVES, toggled, type ShelfId } from '../lib/shelves'
import styles from './FlowerJournalShelf.module.css'
import { Constellations } from './Constellations'
import { gardenRecap } from '../lib/gardenRecap'
import { isQuiet, QUIET_MODE_EVENT, toggleQuiet } from '../lib/quietMode'
import { VoiceRing } from './VoiceRing'
import {
  canRecord,
  deleteVoiceMemory,
  loadVoiceMemory,
  saveVoiceMemory,
  startRecording,
  voiceMemoryIds,
  type Recording,
  type VoiceMemory,
} from '../lib/voiceMemory'

export default function FlowerJournalShelf({ currentGardenId }: { currentGardenId: string }) {
  const [entries, setEntries] = useState<FlowerJournalEntry[]>(() => loadFlowerJournal())
  const [quiet, setQuietState] = useState(isQuiet)
  /** Which entries have audio, so a row can offer playback without loading every blob. */
  const [withVoice, setWithVoice] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState<Record<string, VoiceMemory>>({})
  const [recordingFor, setRecordingFor] = useState<string | null>(null)
  const recording = useRef<Recording | null>(null)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  /** Null shows everything. A shelf id narrows the list to one shelf. */
  const [shelf, setShelf] = useState<ShelfId | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  // One key scan on mount rather than a blob read per row: audio is only fetched when somebody plays it.
  useEffect(() => {
    void voiceMemoryIds().then(setWithVoice)
  }, [])

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

  async function beginRecording(entryId: string): Promise<void> {
    setVoiceError(null)
    try {
      recording.current = await startRecording()
      setRecordingFor(entryId)
    } catch {
      // A dismissed permission prompt is an ordinary choice, not a failure to report loudly.
      setVoiceError('no microphone, or permission was declined.')
    }
  }

  async function finishRecording(entryId: string): Promise<void> {
    const active = recording.current
    recording.current = null
    setRecordingFor(null)
    if (!active) return
    const result = await active.stop()
    if (!result) return
    const memory: VoiceMemory = { entryId, ...result, savedAt: new Date().toISOString() }
    if (await saveVoiceMemory(memory)) {
      setLoaded(current => ({ ...current, [entryId]: memory }))
      setWithVoice(current => new Set(current).add(entryId))
    } else {
      // Out of disk, or private browsing with no store. Losing the audio is bad enough without silence.
      setVoiceError('could not keep that recording on this device.')
    }
  }

  async function playVoice(entryId: string): Promise<void> {
    if (loaded[entryId]) return
    const memory = await loadVoiceMemory(entryId)
    if (memory) setLoaded(current => ({ ...current, [entryId]: memory }))
  }

  async function removeVoice(entryId: string): Promise<void> {
    await deleteVoiceMemory(entryId)
    setLoaded(current => {
      const next = { ...current }
      delete next[entryId]
      return next
    })
    setWithVoice(current => {
      const next = new Set(current)
      next.delete(entryId)
      return next
    })
  }

  // Describes subjects, never cadence, which is why quiet mode leaves it alone. See gardenRecap.ts.
  const recapLine = gardenRecap(entries).line

  function saveMeaning(id: string): void {
    setEntryMeaning(id, draft)
    setEditing(null)
    setEntries(loadFlowerJournal())
  }

  const shown = shelf ? entriesOn(entries, shelf) : entries
  const emptyShelf = shelf ? SHELVES.find(option => option.id === shelf)?.empty : null

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
      {voiceError && <p className={styles.recap}>{voiceError}</p>}
      {/* Filters, not folders: the flower stays on the one shelf and this only narrows what is shown. */}
      <div className={styles.shelfRow} role="group" aria-label="Shelves">
        <button type="button" aria-pressed={shelf === null} onClick={() => setShelf(null)}>
          everything
        </button>
        {SHELVES.map(option => (
          <button
            key={option.id}
            type="button"
            aria-pressed={shelf === option.id}
            onClick={() => setShelf(shelf === option.id ? null : option.id)}
          >
            {option.label}
            {!quiet && entriesOn(entries, option.id).length > 0 && (
              <i> {entriesOn(entries, option.id).length}</i>
            )}
          </button>
        ))}
      </div>
      {shown.length === 0 && emptyShelf && <p className={styles.recap}>{emptyShelf}</p>}
      <ul className={styles.entries}>
        {shown.slice(0, 8).map(entry => (
          <li key={entry.id} className={entry.gardenId === currentGardenId ? styles.current : undefined}>
            <span className={styles.swatches} aria-hidden>
              {entry.colors.slice(0, 3).map((color, index) => <i key={`${color}-${index}`} style={{ background: color }} />)}
            </span>
            <span className={styles.copy}>
              <a href={`/g/${entry.gardenId}`}>{entry.flowerName}</a>
              <small>{entry.from ? `from ${entry.from}` : 'from a bloomnote'}</small>
              {entry.memory && <em>“{entry.memory}”</em>}
              {/* The sender said what it means; this is what it came to mean to whoever kept it. */}
              {editing === entry.id ? (
                <span className={styles.meaningEdit}>
                  <input
                    autoFocus
                    value={draft}
                    maxLength={240}
                    aria-label={`What ${entry.flowerName} means to you`}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') saveMeaning(entry.id)
                      if (event.key === 'Escape') setEditing(null)
                    }}
                  />
                  <button type="button" onClick={() => saveMeaning(entry.id)}>keep</button>
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.meaning}
                  onClick={() => {
                    setEditing(entry.id)
                    setDraft(entry.mine ?? '')
                  }}
                >
                  {meaningOf(entry).text}
                  {!meaningOf(entry).mine && <i> · say what it means to you</i>}
                </button>
              )}
              <span className={styles.shelfChips}>
                {SHELVES.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isOn(entry, option.id)}
                    onClick={() => {
                      setEntryShelves(entry.id, toggled(entry, option.id))
                      setEntries(loadFlowerJournal())
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
              {/* A spoken memory sits under the written one: it is another way to keep the same thing. */}
              {recordingFor === entry.id ? (
                <span className={styles.voiceRow}>
                  <VoiceRing seconds={0} liveStream={recording.current?.stream} />
                  <button type="button" onClick={() => void finishRecording(entry.id)}>
                    stop
                  </button>
                </span>
              ) : loaded[entry.id] ? (
                <span className={styles.voiceRow}>
                  <VoiceRing
                    blob={loaded[entry.id]!.blob}
                    seconds={loaded[entry.id]!.seconds}
                    onDelete={() => void removeVoice(entry.id)}
                  />
                </span>
              ) : withVoice.has(entry.id) ? (
                <button type="button" className={styles.voiceLink} onClick={() => void playVoice(entry.id)}>
                  a voice memory is kept here
                </button>
              ) : (
                canRecord() && (
                  <button type="button" className={styles.voiceLink} onClick={() => void beginRecording(entry.id)}>
                    say it out loud instead
                  </button>
                )
              )}
            </span>
            <button
              type="button"
              className={styles.remove}
              onClick={() => removeFlowerJournalEntry(entry.id)}
              aria-label={`Remove ${entry.flowerName} from flower journal`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {shown.length > 8 && (
        <p className={styles.more}>
          {quiet ? 'more flowers are tucked away.' : `${shown.length - 8} more flowers are tucked away.`}
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
