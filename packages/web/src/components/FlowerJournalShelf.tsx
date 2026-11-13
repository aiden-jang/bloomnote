import { useEffect, useState } from 'react'
import {
  FLOWER_JOURNAL_EVENT,
  loadFlowerJournal,
  removeFlowerJournalEntry,
  setEntryMeaning,
  setEntryShelves,
  type FlowerJournalEntry,
} from '../lib/flowerJournal'
import { entriesOn, isOn, MAX_MEANING, meaningOf, SHELVES, toggled, type ShelfId } from '../lib/shelves'
import styles from './FlowerJournalShelf.module.css'
import { Constellations } from './Constellations'
import { gardenRecap } from '../lib/gardenRecap'
import { isQuiet, QUIET_MODE_EVENT, toggleQuiet } from '../lib/quietMode'
import { VoiceRing } from './VoiceRing'
import { canRecord } from '../lib/voiceMemory'
import { useJournalVoice } from '../lib/useJournalVoice'
import FlowerSVG from './FlowerSVG'
import { cardBloom } from '../lib/cardBloom'

const JOURNAL_PREVIEW = 8

export default function FlowerJournalShelf({ currentGardenId }: { currentGardenId: string }) {
  const [entries, setEntries] = useState<FlowerJournalEntry[]>(() => loadFlowerJournal())
  const [showAll, setShowAll] = useState(false)
  const [quiet, setQuietState] = useState(isQuiet)
  const voice = useJournalVoice(entries.map((entry) => entry.id))
  const [journalError, setJournalError] = useState<string | null>(null)
  const [shelf, setShelf] = useState<ShelfId | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

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

  function saveMeaning(id: string): void {
    if (!setEntryMeaning(id, draft)) {
      setJournalError(
        'could not save on this device. Your words are still here. Try again after freeing storage.',
      )
      return
    }
    setJournalError(null)
    setEditing(null)
    setEntries(loadFlowerJournal())
  }

  const shown = shelf ? entriesOn(entries, shelf) : entries
  const visible = showAll ? shown : shown.slice(0, JOURNAL_PREVIEW)
  const emptyShelf = shelf ? SHELVES.find((option) => option.id === shelf)?.empty : null

  return (
    <section ref={voice.root} className={styles.shelf} aria-labelledby="flower-journal-heading">
      <div className={styles.heading}>
        <span>
          <strong id="flower-journal-heading">my flower journal</strong>
          <small>kept only on this device</small>
        </span>
        {!quiet && <span className={styles.count}>{entries.length}</span>}
      </div>
      {journalError && (
        <p className={styles.voiceNote} role="alert">
          {journalError}
        </p>
      )}
      {recapLine && <p className={styles.recap}>{recapLine}</p>}
      <div className={styles.shelfRow} role="group" aria-label="Shelves">
        <button type="button" aria-pressed={shelf === null} onClick={() => setShelf(null)}>
          everything
        </button>
        {SHELVES.map((option) => (
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
        {visible.map((entry) => (
          <li key={entry.id} className={entry.gardenId === currentGardenId ? styles.current : undefined}>
            {/* Keyed on the garden and the flower's place in it, so a re-rolled garden never inherits the
                kept flower from the one it replaced. */}
            <span className={styles.swatches} aria-hidden>
              <FlowerSVG
                flower={cardBloom(entry.colors[0] ?? '#cbd6c2', entry.gardenId, entry.flowerIndex)}
                index={entry.flowerIndex}
                bloomed
                staticRender
              />
            </span>
            <span className={styles.copy}>
              <a href={`/g/${entry.gardenId}`}>{entry.flowerName}</a>
              <small>{entry.from ? `from ${entry.from}` : 'from a bloomnote'}</small>
              {entry.memory && <em>“{entry.memory}”</em>}
              {editing === entry.id ? (
                <span className={styles.meaningEdit}>
                  <input
                    // Editing replaces the row's memory with this field, so focus belongs where
                    // the words just were.
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus
                    value={draft}
                    maxLength={MAX_MEANING}
                    aria-label={`What ${entry.flowerName} means to you`}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveMeaning(entry.id)
                      if (event.key === 'Escape') setEditing(null)
                    }}
                  />
                  <button type="button" onClick={() => saveMeaning(entry.id)}>
                    keep
                  </button>
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
                {SHELVES.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={isOn(entry, option.id)}
                    onClick={() => {
                      setJournalError(
                        setEntryShelves(entry.id, toggled(entry, option.id))
                          ? null
                          : 'could not save this shelf on this device. Try again.',
                      )
                      setEntries(loadFlowerJournal())
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </span>
              {voice.recordingFor === entry.id ? (
                <span className={styles.voiceRow}>
                  <VoiceRing seconds={0} liveStream={voice.recording.current?.stream} />
                  <button type="button" onClick={() => void voice.finish(entry.id)}>
                    stop
                  </button>
                </span>
              ) : voice.loaded[entry.id] ? (
                <span className={styles.voiceRow}>
                  <VoiceRing
                    blob={voice.loaded[entry.id]!.blob}
                    seconds={voice.loaded[entry.id]!.seconds}
                    onDelete={() => void voice.remove(entry.id)}
                  />
                </span>
              ) : voice.withVoice.has(entry.id) ? (
                <button type="button" className={styles.voiceLink} onClick={() => void voice.play(entry.id)}>
                  a voice memory is kept here
                </button>
              ) : (
                canRecord() && (
                  <button
                    type="button"
                    className={styles.voiceLink}
                    disabled={voice.pending || voice.recordingFor !== null}
                    onClick={() => void voice.begin(entry.id)}
                  >
                    {voice.pending ? 'waiting for microphone…' : 'say it out loud instead'}
                  </button>
                )
              )}
              {voice.error?.id === entry.id && (
                <small className={styles.voiceNote} role="status">
                  {voice.error.text}
                </small>
              )}
            </span>
            <button
              type="button"
              className={styles.remove}
              onClick={() =>
                setJournalError(
                  removeFlowerJournalEntry(entry.id)
                    ? null
                    : 'could not remove this flower on this device. Try again.',
                )
              }
              aria-label={`Remove ${entry.flowerName} from flower journal`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {shown.length > JOURNAL_PREVIEW && (
        <p className={styles.more}>
          <button type="button" className={styles.moreBtn} onClick={() => setShowAll((open) => !open)}>
            {showAll
              ? 'tuck them back'
              : quiet
                ? 'more flowers are tucked away. show them all'
                : `${shown.length - JOURNAL_PREVIEW} more flowers are tucked away. show them all`}
          </button>
        </p>
      )}
      <Constellations entries={entries} />
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
