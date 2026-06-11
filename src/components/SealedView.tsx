import { useEffect, useState } from 'react'
import styles from './SealedView.module.css'

interface Props {
  from?: string
  to?: string
  /** ISO 8601 unlock moment. */
  unlockAt: string
  /** Fires when the unlock moment arrives — caller swaps to the real
   *  recipient view. */
  onUnlock: () => void
}

/**
 * Sealed envelope + live countdown for time-capsule gardens.
 *
 * The whole conceit hinges on anticipation: the recipient knows
 * *something* is here, knows who it's from, knows roughly when it
 * opens — but the garden itself stays hidden until the moment. So
 * the design choices are:
 *
 *   - No glimpse of the flowers. Not even silhouettes. The reveal
 *     needs to feel like a reveal.
 *   - A live countdown, updating every second when close, less often
 *     when far. Constant ticking turns "wait 3 months" into theater.
 *   - Sender's name prominent so the receiver knows whose moment
 *     they're anticipating.
 *   - Once the unlock time hits, the page smoothly transitions to the
 *     normal recipient view via the parent's onUnlock callback.
 *
 * Clock skew note: we trust the client's clock for the countdown.
 * Spoofing the device clock would let a recipient open early — and
 * that's fine. This is a UX choreography, not a security boundary.
 */
export default function SealedView({ from, to, unlockAt, onUnlock }: Props) {
  const target = new Date(unlockAt).getTime()
  const [now, setNow] = useState(() => Date.now())

  // Pick a tick interval scaled to how far away the unlock is. No
  // point burning a setInterval every second when the next change is
  // hours away — but right before unlock we want frame-accurate
  // updates so the "0 seconds remaining" → bloom transition feels
  // sharp.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const remaining = target - Date.now()
    const interval =
      remaining < 60_000 ? 250 :       // under a minute → 4Hz
      remaining < 3600_000 ? 1000 :    // under an hour  → 1Hz
      remaining < 86400_000 ? 30_000 : // under a day    → every 30s
      300_000                          // longer         → every 5m
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [target, now])

  // Fire the unlock callback exactly once, when the clock crosses the
  // boundary. Using `now` in the deps ensures we re-check on every tick.
  useEffect(() => {
    if (now >= target) onUnlock()
  }, [now, target, onUnlock])

  const remaining = Math.max(0, target - now)
  const unlockDate = new Date(unlockAt)

  return (
    <div className={styles.wrap}>
      <div className={styles.topLabel}>
        {from ? (
          <p className={styles.fromText}>
            <span className={styles.fromName}>{from}</span> sent {to ? to : 'you'} a garden
          </p>
        ) : (
          <p className={styles.fromText}>
            someone sent {to ? to : 'you'} a garden
          </p>
        )}
      </div>

      {/* The sealed plot. Same dimensions as GardenScene so the bloom
          feels like *this exact place* opening, not a new page. */}
      <div className={styles.plot} aria-hidden>
        <svg viewBox="0 0 200 120" className={styles.envelope}>
          {/* Sealed envelope — folded flap, wax seal. Deliberately
              not a flower; the flowers stay hidden. */}
          <rect x="30" y="35" width="140" height="70" rx="4"
            fill="var(--cream)" stroke="var(--green-deep)" strokeWidth="1.5" />
          <path d="M 30 35 L 100 80 L 170 35"
            fill="none" stroke="var(--green-deep)" strokeWidth="1.5" />
          <circle cx="100" cy="80" r="9"
            fill="var(--pink-mid)" stroke="var(--pink-deep)" strokeWidth="1" />
          <text x="100" y="84" textAnchor="middle"
            fontSize="9" fill="var(--pink-deep)" fontFamily="Fraunces, serif">
            ✿
          </text>
        </svg>
      </div>

      <div className={styles.countdown}>
        <p className={styles.opensLabel}>opens in</p>
        <p className={styles.opensRelative}>{formatRemaining(remaining)}</p>
        <p className={styles.opensExact}>{formatExact(unlockDate)}</p>
      </div>

      <p className={styles.hint}>come back when it&rsquo;s time.</p>
    </div>
  )
}

// ---- formatting helpers ------------------------------------------------

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  // Show the two most-significant non-zero units. "3d 14h" reads
  // cleaner than "3 days, 14 hours, 27 minutes, 16 seconds" when
  // you're waiting weeks. Drop to mm:ss in the last minute for the
  // anticipation crescendo.
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function formatExact(d: Date): string {
  // Local-time formatting so the recipient sees their own timezone.
  // Avoids the "this opens at 3am" footgun caused by storing UTC.
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
