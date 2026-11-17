import { useEffect, useId, useRef, useState } from 'react'
import {
  fetchGardenResponse,
  hasWatered,
  rememberedFeeling,
  rememberWatered,
  sendFeeling,
  sendWater,
  watersLabel,
  type Feeling,
} from '../lib/water'
import { playWater } from '../sound'
import { occasionTone } from '../lib/occasions'
import FeelingMark from './FeelingMark'
import styles from './Watering.module.css'

interface Props {
  gardenId: string
  onWatered: () => void
  occasion?: string | undefined
}

export default function Watering({ gardenId, onWatered, occasion }: Props) {
  const [waters, setWaters] = useState(0)
  const [watered, setWatered] = useState(() => hasWatered(gardenId))
  const [busy, setBusy] = useState(false)
  const [feeling, setFeeling] = useState<Feeling | null>(() => rememberedFeeling(gardenId))
  const [feelings, setFeelings] = useState<Partial<Record<Feeling, number>>>({})
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)
  const interacted = useRef(false)
  const labelId = useId()
  const gentle = occasionTone(occasion) === 'sensitive'
  const choices: Feeling[] = gentle ? ['love', 'comfort', 'hug'] : ['love', 'comfort', 'joy', 'hug']

  useEffect(() => {
    let cancelled = false
    void fetchGardenResponse(gardenId).then((response) => {
      if (!cancelled && !interacted.current) {
        setWaters(response.waters)
        setFeelings(response.feelings)
      }
    })
    return () => {
      cancelled = true
    }
  }, [gardenId])

  const water = async (): Promise<void> => {
    if (watered || busyRef.current) return
    busyRef.current = true
    interacted.current = true
    setBusy(true)
    // The gesture and drops happen on tap; a failed count update never asks for another watering.
    setWatered(true)
    playWater()
    rememberWatered(gardenId)
    onWatered()
    const n = await sendWater(gardenId)
    if (n !== null) setWaters(n)
    busyRef.current = false
    setBusy(false)
  }

  const respond = async (next: Feeling): Promise<void> => {
    if (feeling || busyRef.current) return
    busyRef.current = true
    interacted.current = true
    setBusy(true)
    setError(null)
    const response = await sendFeeling(gardenId, next)
    if (response) {
      setFeeling(next)
      setFeelings(response.feelings)
      setWaters((current) => Math.max(current, response.waters))
    } else setError('Couldn’t send that feeling. Try again.')
    busyRef.current = false
    setBusy(false)
  }

  const others = watered ? Math.max(0, waters - 1) : waters
  const echoes = Object.entries(feelings).filter(
    (entry): entry is [Feeling, number] =>
      Object.hasOwn(FEELING_COPY, entry[0]) && typeof entry[1] === 'number' && entry[1] > 0,
  )

  return (
    <div className={styles.row} data-gentle={gentle}>
      {feeling ? (
        <p className={styles.feelingDone} role="status">
          sent back {FEELING_COPY[feeling].sent}
        </p>
      ) : (
        <div className={styles.feelings}>
          <span id={labelId} className={styles.feelingsLabel}>
            send a feeling back
          </span>
          <div
            className={styles.feelingsChips}
            role="group"
            aria-labelledby={labelId}
            style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0, 1fr))` }}
          >
            {choices.map((kind) => (
              <button key={kind} type="button" disabled={busy} onClick={() => void respond(kind)}>
                <FeelingMark kind={kind} /> {FEELING_COPY[kind].label}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.watering}>
        {watered ? (
          <p className={styles.done}>
            <Can poured />
            you watered it
            {others > 0 && (
              <span className={styles.others}>
                , with {others} other watering {others === 1 ? 'gesture' : 'gestures'}
              </span>
            )}
          </p>
        ) : (
          <>
            <button type="button" className={styles.btn} onClick={() => void water()} disabled={busy}>
              <Can />
              water it
            </button>
            {waters > 0 && <span className={styles.count}>{watersLabel(waters)} already</span>}
          </>
        )}
      </div>
      {(watered || feeling) && echoes.length > 0 && (
        <p className={styles.feelingEcho}>
          {echoes.map(([kind, count]) => `${FEELING_COPY[kind].emoji} ${count}`).join('  ·  ')}
        </p>
      )}
    </div>
  )
}

const FEELING_COPY: Record<Feeling, { emoji: string; label: string; sent: string }> = {
  love: { emoji: '♡', label: 'love', sent: 'a little love' },
  comfort: { emoji: '☁', label: 'comfort', sent: 'some comfort' },
  joy: { emoji: '✦', label: 'joy', sent: 'a spark of joy' },
  hug: { emoji: 'ʕっ•ᴥ•ʔっ', label: 'a hug', sent: 'a tiny hug' },
}

function Can({ poured = false }: { poured?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 18"
      className={poured ? `${styles.can} ${styles.canPoured}` : styles.can}
      aria-hidden
    >
      <path d="M8 7 L1.5 3.2 L3 7.4 L8 10.5 Z" fill="currentColor" />
      <rect x="7.5" y="4.5" width="10.5" height="11" rx="2.4" fill="currentColor" />
      <path
        d="M9.8 4.6 Q12.8 0.6 15.8 4.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}
