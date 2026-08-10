import { useEffect, useState } from 'react'
import { fetchWaters, hasWatered, rememberWatered, sendWater, watersLabel } from '../lib/water'
import { playWater } from '../sound'
import styles from './Watering.module.css'

interface Props {
  gardenId: string
  /** Called after a successful water, so the scene can drop the drops. */
  onWatered: () => void
}

/**
 * "I saw this."
 *
 * The sender used to get nothing back. Replying means composing an entire garden, which is far more
 * than most people will do for a feeling that only needs acknowledging, so the loop stayed open and
 * the sender never learned whether the thing landed. One tap closes it.
 *
 * Sits under the plot but mounts only after the note has appeared, so during the bloom — the one
 * moment this screen exists for — there is no button competing with the flowers.
 */
export default function Watering({ gardenId, onWatered }: Props) {
  const [waters, setWaters] = useState(0)
  const [watered, setWatered] = useState(() => hasWatered(gardenId))
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    void fetchWaters(gardenId).then(n => {
      if (!cancelled) setWaters(n)
    })
    return () => {
      cancelled = true
    }
  }, [gardenId])

  const water = async (): Promise<void> => {
    if (watered || busy) return
    setBusy(true)
    // Optimistic: the drops fall on the tap, not on the round trip. A failed write leaves the count
    // where it was and the button spent, which is the right way round — nagging someone to try
    // again would make a gesture feel like a form.
    setWatered(true)
    playWater()
    rememberWatered(gardenId)
    onWatered()
    const n = await sendWater(gardenId)
    if (n !== null) setWaters(n)
    setBusy(false)
  }

  // Your own tap is already reflected in `waters`, so the rest of them is one fewer.
  const others = watered ? Math.max(0, waters - 1) : waters

  return (
    <div className={styles.row}>
      {watered ? (
        <p className={styles.done}>
          <Can poured />
          you watered it
          {others > 0 && <span className={styles.others}>, and {others === 1 ? 'someone else did too' : `${others} others did too`}</span>}
        </p>
      ) : (
        <>
          <button type="button" className={styles.btn} onClick={() => void water()}>
            <Can />
            water it
          </button>
          {waters > 0 && <span className={styles.count}>{watersLabel(waters)} already</span>}
        </>
      )}
    </div>
  )
}

/** A small can, tipped further over once it has been used. */
function Can({ poured = false }: { poured?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 18"
      className={poured ? `${styles.can} ${styles.canPoured}` : styles.can}
      aria-hidden
    >
      {/* Spout, tapering out to the left where the water leaves. */}
      <path d="M8 7 L1.5 3.2 L3 7.4 L8 10.5 Z" fill="currentColor" />
      {/* Body. */}
      <rect x="7.5" y="4.5" width="10.5" height="11" rx="2.4" fill="currentColor" />
      {/* Handle, drawn as an open arc so it reads as a handle and not a lump. */}
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
