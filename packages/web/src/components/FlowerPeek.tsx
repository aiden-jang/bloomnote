import { useEffect, useState } from 'react'
import FlowerSVG from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { withoutLeadingFlowerName } from '../lib/flowerMeaning'
import { saveFlowerImage } from '../lib/gardenImage'
import { flowerJournalEntry, saveFlowerJournalEntry } from '../lib/flowerJournal'
import styles from './FlowerPeek.module.css'

const FLASH_MS = 2200

type ShareStatus = 'sharing' | 'shared' | 'copied' | null
type ImageStatus = 'saving' | 'shared' | 'downloaded' | null

type Props = {
  flower: FlowerSpec
  index: number
  journalGardenId?: string | undefined
  journalFrom?: string | undefined
  onClose: () => void
}

export default function FlowerPeek({ flower, index, journalGardenId, journalFrom, onClose }: Props) {
  const [shareStatus, setShareStatus] = useState<ShareStatus>(null)
  const [imageStatus, setImageStatus] = useState<ImageStatus>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalError, setJournalError] = useState<string | null>(null)
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
    setActionError(null)
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
      setActionError('couldn’t share. Select and copy the flower meaning below, or try again.')
    }
  }

  const saveImage = async (): Promise<void> => {
    if (imageStatus) return
    setActionError(null)
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
      setActionError('couldn’t make the card. Try again, or share this garden’s link.')
    }
  }

  const keep = (): void => {
    if (!journalGardenId) return
    const saved = saveFlowerJournalEntry({
      gardenId: journalGardenId,
      flowerIndex: index,
      flower,
      memory: journal.memory,
      from: journalFrom,
    })
    if (!saved) {
      setJournalError(
        'could not save on this device. Your words are still here. Try again after freeing storage.',
      )
      return
    }
    setJournalError(null)
    setJournal((current) => ({ ...current, saved: true }))
    setJournalOpen(false)
  }

  return (
    <aside
      id="flower-peek"
      className={styles.flowerPeek}
      aria-label={`${flower.name} meaning and journal`}
      aria-live="polite"
      data-flower-peek=""
    >
      <span className={styles.flowerPeekSwatches} aria-hidden>
        <FlowerSVG flower={flower} index={index} bloomed staticRender />
      </span>
      <div className={styles.flowerPeekCopy}>
        <h2>{flower.name}</h2>
        <p className={styles.flowerMeaning}>{meaning}</p>
        {journalGardenId && (
          <button
            type="button"
            className={styles.flowerPeekKeep}
            onClick={() => setJournalOpen((open) => !open)}
            aria-expanded={journalOpen}
          >
            {journal.saved ? 'edit journal memory' : 'keep in my flower journal'}
          </button>
        )}
        <div className={styles.flowerPeekActions}>
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
                  ? 'download started'
                  : 'save a pressed-flower card'}
          </button>
        </div>
        {actionError && (
          <div className={styles.flowerPeekError}>
            <p role="alert">{actionError}</p>
            <textarea
              aria-label="Flower meaning to copy"
              readOnly
              rows={2}
              value={`${flower.name}: ${meaning}`}
              onFocus={(event) => event.currentTarget.select()}
            />
          </div>
        )}
        {journalGardenId && (
          <>
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
                  // The editor is revealed by its own button, so the cursor should already be in
                  // it rather than a tab away.
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                />
                {journalError && <p role="alert">{journalError}</p>}
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
      </div>
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
