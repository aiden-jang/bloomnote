import { useRef, useState } from 'react'
import { FlowerHead } from './FlowerSVG'
import { cardBloom } from '../lib/cardBloom'
import { buildShareUrl, fetchGarden, type GardenData } from '../garden'
import { saveGardenImage } from '../lib/gardenImage'
import { trackCardDownloaded, trackGardenReshared } from '../lib/analytics'
import { watersLabel, type Feeling } from '../lib/water'
import { labelFor as occasionLabel } from '../lib/occasions'
import { formatGardenDate } from '../lib/formatDate'
import styles from './MyGardens.module.css'
import type { CardData, Tab } from '../lib/gardenList'

export interface RowProps {
  record: CardData
  kind: Tab
  waters?: number
  feelings?: Partial<Record<Feeling, number>>
  pinned?: boolean
  onPin?: () => void
  onRemove?: () => void
}

export default function GardenRow({
  record,
  kind,
  waters = 0,
  feelings = {},
  pinned = false,
  onPin,
  onRemove,
}: RowProps) {
  const { id, from, to, occasion, createdAt, unlockAt, receivedAt, swatches } = record
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)

  // The list summary only has colour swatches, not full flower specs, so the garden must be fetched
  // before its share image can be built. Prefetch on interaction-intent and cache the promise, so
  // the click-to-share gap stays inside the user-activation window navigator.share requires.
  const gardenRef = useRef<Promise<GardenData | null> | null>(null)
  const prefetch = (): void => {
    if (gardenRef.current) return
    const p = fetchGarden(id)
    gardenRef.current = p
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
      // Drop the cached fetch so the next tap retries rather than re-awaiting a rejected promise.
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
      text:
        kind === 'received' && from
          ? `A garden from ${from}`
          : to.trim()
            ? `A garden for ${to.trim()}`
            : 'A garden for you',
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
  const strongestFeeling = (Object.entries(feelings) as [Feeling, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])[0]
  const feelingEmoji: Record<Feeling, string> = { love: '♡', comfort: '☁', joy: '✦', hug: 'ʕっ•ᴥ•ʔっ' }

  return (
    <li className={styles.card}>
      <a href={`/g/${id}`} className={styles.cardMain}>
        <span className={styles.swatches} aria-hidden>
          {(swatches.length > 0 ? swatches : ['#cbd6c2']).map((c, i) => (
            <span key={i} className={styles.swatch}>
              <FlowerHead flower={cardBloom(c, id, i)} size={44} />
            </span>
          ))}
        </span>
        <span className={styles.cardText}>
          <span className={styles.recipient}>{cardLabel}</span>
          <span className={styles.meta}>
            {occasion && <span>{occasionLabel(occasion)}</span>}
            {sealedUntil ? (
              <span className={styles.sealed}>opens {sealedUntil}</span>
            ) : (
              (kind === 'received' ? (keptOn ?? grownOn) : grownOn) && (
                <span>{kind === 'received' && keptOn ? `kept ${keptOn}` : grownOn}</span>
              )
            )}
            {waters > 0 && <span className={styles.watered}>{watersLabel(waters)}</span>}
            {strongestFeeling && (
              <span className={styles.watered} title={`${strongestFeeling[1]} felt ${strongestFeeling[0]}`}>
                {feelingEmoji[strongestFeeling[0]]} felt like {strongestFeeling[0]}
              </span>
            )}
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
                ? 'download started'
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
