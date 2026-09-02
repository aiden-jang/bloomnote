import { useEffect, useState } from 'react'
import { FlowerHead } from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { withoutLeadingFlowerName } from '../lib/flowerMeaning'
import { saveFlowerImage } from '../lib/gardenImage'
import { flowerJournalEntry, saveFlowerJournalEntry } from '../lib/flowerJournal'
import styles from './GardenScene.module.css'

const FLASH_MS = 2200

type ShareStatus = 'sharing' | 'shared' | 'copied' | null
type ImageStatus = 'saving' | 'shared' | 'downloaded' | null

type Props = {
  flower: FlowerSpec
  index: number
  journalGardenId?: string | undefined
  journalFrom?: string | undefined
  onClose: () => void
  onHover: () => void
  onHoverEnd: () => void
}

export default function FlowerPeek({
  flower,
  index,
  journalGardenId,
  journalFrom,
  onClose,
  onHover,
  onHoverEnd,
}: Props) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null)
  const [imageStatus, setImageStatus] = useState<ImageStatus>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [journal, setJournal] = useState(() => {
    const existing = journalGardenId ? flowerJournalEntry(journalGardenId, index) : null
    return { memory: existing?.memory ?? '', saved: existing !== null }
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      // One layer at a time: closing the whole panel here would discard a half-written memory.
      if (journalOpen) {
        setJournalOpen(false)
        return
      }
      onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [journalOpen, onClose])

  const meaning = withoutLeadingFlowerName(flower.name, flower.meaning)

  const share = async (): Promise<void> => {
    if (shareStatus) return
    const text = `${flower.name}: ${meaning}`
    const finish = (status: 'shared' | 'copied'): void => {
      setShareStatus(status)
      window.setTimeout(() => setShareStatus(null), FLASH_MS)
    }
    setShareStatus('sharing')
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: flower.name, text, url: window.location.href })
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
      await navigator.clipboard.writeText(text)
      finish('copied')
    } catch {
      setShareStatus(null)
    }
  }

  const saveImage = async (): Promise<void> => {
    if (imageStatus) return
    setImageStatus('saving')
    try {
      const result = await saveFlowerImage(flower, meaning)
      if (result === 'dismissed') {
        setImageStatus(null)
        return
      }
      setImageStatus(result)
      window.setTimeout(() => setImageStatus(null), FLASH_MS)
    } catch {
      setImageStatus(null)
    }
  }

  const keep = (): void => {
    if (!journalGardenId) return
    saveFlowerJournalEntry({
      gardenId: journalGardenId,
      flowerIndex: index,
      flower,
      memory: journal.memory,
      from: journalFrom,
    })
    setJournal((current) => ({ ...current, saved: true }))
    setJournalOpen(false)
  }

  return (
    <aside
      id="flower-peek"
      className={styles.flowerPeek}
      aria-live="polite"
      data-flower-peek=""
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      <span className={styles.flowerPeekSwatches} aria-hidden>
        <FlowerHead flower={flower} size={30} />
      </span>
      <span className={styles.flowerPeekCopy}>
        <strong>{flower.name}</strong>
        <span>{meaning}</span>
        <button
          type="button"
          className={styles.flowerPeekShare}
          onClick={() => void share()}
          disabled={shareStatus !== null}
        >
          {shareStatus === 'sharing'
            ? 'opening…'
            : shareStatus === 'shared'
              ? 'shared'
              : shareStatus === 'copied'
                ? 'meaning copied'
                : 'share this flower'}
        </button>
        <button
          type="button"
          className={styles.flowerPeekShare}
          onClick={() => void saveImage()}
          disabled={imageStatus !== null}
        >
          {imageStatus === 'saving'
            ? 'pressing flower…'
            : imageStatus === 'shared'
              ? 'keepsake shared'
              : imageStatus === 'downloaded'
                ? 'keepsake saved'
                : 'save a pressed-flower card'}
        </button>
        {journalGardenId && (
          <>
            <button
              type="button"
              className={styles.flowerPeekShare}
              onClick={() => setJournalOpen((open) => !open)}
              aria-expanded={journalOpen}
            >
              {journal.saved ? 'edit journal memory' : 'keep in my flower journal'}
            </button>
            {journalOpen && (
              <div className={styles.journalEditor}>
                <label htmlFor={`flower-memory-${index}`}>what do you want to remember?</label>
                <textarea
                  id={`flower-memory-${index}`}
                  value={journal.memory}
                  onChange={(event) => setJournal((current) => ({ ...current, memory: event.target.value }))}
                  maxLength={240}
                  rows={2}
                  placeholder="the moment, the person, the reason…"
                  autoFocus
                />
                <div>
                  <span>{journal.memory.length}/240</span>
                  <button type="button" onClick={keep}>
                    {journal.saved ? 'update memory' : 'press into journal'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </span>
      <button
        type="button"
        className={styles.flowerPeekClose}
        onClick={onClose}
        aria-label="Close flower meaning"
      >
        ×
      </button>
    </aside>
  )
}
