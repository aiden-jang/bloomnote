import { useEffect, useMemo, useState } from 'react'
import { FlowerHead } from './FlowerSVG'
import { cardBloom } from '../lib/cardBloom'
import type { Feeling } from '../lib/water'
import { formatGardenDate } from '../lib/formatDate'
import { gardenMemoryDeck, gardenMemoryLabel } from '../lib/gardenMemories'
import { gardenImpact } from '../lib/gardenImpact'
import type { CardData, Tab } from '../lib/gardenList'
import styles from './MyGardens.module.css'

const feelingCopy: Record<Feeling, { emoji: string; noun: string }> = {
  love: { emoji: '♡', noun: 'love' },
  comfort: { emoji: '☁', noun: 'comfort' },
  joy: { emoji: '✦', noun: 'joy' },
  hug: { emoji: 'ʕっ•ᴥ•ʔっ', noun: 'hugs' },
}

export function GardenImpactCard({
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
Most sent back: ${strongest.emoji} ${strongest.noun}`
      : ''
    const text = `What came back from my gardens
${impact.totalWaters} ${impact.totalWaters === 1 ? 'watering gesture' : 'watering gestures'} · ${impact.totalFeelings} ${impact.totalFeelings === 1 ? 'feeling' : 'feelings'} sent back across ${impact.respondedGardens} ${impact.respondedGardens === 1 ? 'garden' : 'gardens'}${feelingLine}`
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
          <strong>A few things came back from your gardens.</strong>
        </span>
        <span className={styles.impactSprout} aria-hidden>
          ❀
        </span>
      </div>
      <div className={styles.impactStats}>
        <span>
          <strong>{impact.totalWaters}</strong>
          <small>{impact.totalWaters === 1 ? 'watering gesture' : 'watering gestures'}</small>
        </span>
        <span>
          <strong>{impact.totalFeelings}</strong>
          <small>feelings sent back</small>
        </span>
        <span>
          <strong>{impact.respondedGardens}</strong>
          <small>gardens with a response</small>
        </span>
      </div>
      {(strongest || favoriteName) && (
        <p className={styles.impactNote}>
          {strongest && (
            <span>
              most sent back: {strongest.emoji} {strongest.noun}
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
          ? 'opening sharing…'
          : shareStatus === 'shared'
            ? 'share sheet closed'
            : shareStatus === 'copied'
              ? 'recap copied'
              : 'share this recap'}
      </button>
    </aside>
  )
}

export function MemoryLane({ gardens, kind }: { gardens: CardData[]; kind: Tab }) {
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
          <span className={styles.memoryEyebrow}>a garden to revisit</span>
          <strong>
            {kind === 'received'
              ? `a garden ${name ? `from ${name}` : 'you kept'}`
              : `the one ${name ? `for ${name}` : 'you grew'}`}
          </strong>
          {(age || date) && <small>{[age, date].filter(Boolean).join(' · ')}</small>}
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
