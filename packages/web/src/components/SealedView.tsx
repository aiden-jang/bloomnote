import BloomBrand from './BloomBrand'
import { useEffect, useState } from 'react'
import styles from './SealedView.module.css'
import { keepsakeFilename } from '../lib/keepsakeFilename'

interface Props {
  gardenId: string
  from?: string | undefined
  to?: string | undefined
  unlockAt: string
  onUnlock: () => void
}

export default function SealedView({ gardenId, from, to, unlockAt, onUnlock }: Props) {
  const target = new Date(unlockAt).getTime()
  const [now, setNow] = useState(() => Date.now())
  const [calendarSaved, setCalendarSaved] = useState(false)

  // Tick interval scaled to how far away the unlock is. No point burning a setInterval every second
  // on a capsule that opens in three weeks.
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const remaining = target - Date.now()
    const interval =
      remaining < 60_000
        ? 250 // under a minute → 4Hz
        : remaining < 3600_000
          ? 1000 // under an hour  → 1Hz
          : remaining < 86400_000
            ? 30_000 // under a day    → every 30s
            : 300_000 // longer         → every 5m
    const id = setInterval(tick, interval)
    return () => clearInterval(id)
  }, [target, now])

  // Fire the unlock callback exactly once, when the clock crosses the boundary.
  useEffect(() => {
    if (now >= target) onUnlock()
  }, [now, target, onUnlock])

  const remaining = Math.max(0, target - now)
  const unlockDate = new Date(unlockAt)
  const eventName = from ? `${from}'s garden opens` : 'A garden for you opens'
  const eventEnd = new Date(unlockDate.getTime() + 30 * 60_000)
  const eventDetails = 'A garden is ready to bloom. Open this event to return to it.'
  const stamp = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '')
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventName)}&dates=${stamp(unlockDate)}/${stamp(eventEnd)}&details=${encodeURIComponent(eventDetails)}&location=${encodeURIComponent(window.location.href)}`
  const outlookCalendarUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(eventName)}&startdt=${encodeURIComponent(unlockDate.toISOString())}&enddt=${encodeURIComponent(eventEnd.toISOString())}&body=${encodeURIComponent(eventDetails)}&location=${encodeURIComponent(window.location.href)}`
  const addToCalendar = () => {
    const start = new Date(unlockAt)
    const end = new Date(start.getTime() + 30 * 60_000)
    const escape = (s: string) => s.replace(/[\\,;\n]/g, (c) => (c === '\n' ? '\\n' : `\\${c}`))
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//bloomnote//garden//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:bloomnote-${gardenId}@aidenjang.com`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(eventName)}`,
      `URL:${window.location.href}`,
      `DESCRIPTION:${escape(eventDetails)}`,
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Your bloomnote garden opens in 15 minutes. Tap the event to return to it.',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const href = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = href
    a.download = keepsakeFilename(`garden-opening-${to || from || 'garden'}`, 'ics')
    // Keep the URL alive long enough for Safari and mobile browsers to hand the file to their
    // download handler before it is revoked.
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(href), 1000)
    setCalendarSaved(true)
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.topLabel}>
        <BloomBrand />
        <h1 className={styles.fromText}>
          {from ? (
            <>
              <span className={styles.fromName}>{from}</span> grew {to ? to : 'you'} a garden
            </>
          ) : (
            <>someone grew {to ? to : 'you'} a garden</>
          )}
        </h1>
      </div>

      <div className={styles.plot} aria-hidden>
        <svg viewBox="0 0 200 120" className={styles.envelope}>
          <ellipse cx="100" cy="109" rx="58" ry="4.5" fill="var(--green-deep)" opacity="0.07" />

          <path
            d="M 31 39 Q 30.6 35.6 34.2 35.3 L 166.2 35.1 Q 169.7 35.5 169.4 39.1
               L 169.7 101.2 Q 169.9 104.7 166.3 104.9 L 33.8 105.1 Q 30.1 104.9 30.3 101.2 Z"
            fill="var(--cream)"
            stroke="var(--green-deep)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />

          <path d="M 31 37 Q 62 60 100 79.5 Q 138 60 169 37 Z" fill="var(--green-deep)" opacity="0.055" />
          <path
            d="M 31 36.6 Q 62 60 100 79.5 Q 138 60 169 36.6"
            fill="none"
            stroke="var(--green-deep)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Wax seal. The flower on it was a glyph set in Fraunces, which put a piece of the art at the
              mercy of whether the font loaded. */}
          <circle cx="100" cy="80" r="10" fill="var(--pink-mid)" stroke="var(--pink-deep)" strokeWidth="1" />
          {Array.from({ length: 5 }).map((_, i) => {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2
            return (
              <ellipse
                key={i}
                cx={100 + Math.cos(angle) * 4.1}
                cy={80 + Math.sin(angle) * 4.1}
                rx="2.7"
                ry="1.8"
                fill="var(--pink-deep)"
                opacity="0.72"
                transform={`rotate(${(i / 5) * 360}, ${100 + Math.cos(angle) * 4.1}, ${80 + Math.sin(angle) * 4.1})`}
              />
            )
          })}
          <circle cx="100" cy="80" r="1.9" fill="var(--pink-deep)" />
          <ellipse
            cx="96.6"
            cy="76.4"
            rx="2.6"
            ry="1.7"
            fill="#fff"
            opacity="0.3"
            transform="rotate(-35, 96.6, 76.4)"
          />
        </svg>
      </div>

      <div className={styles.countdown}>
        <p className={styles.opensLabel}>opens in</p>
        <p className={styles.opensRelative}>{formatRemaining(remaining)}</p>
        <p className={styles.opensExact}>{formatExact(unlockDate)}</p>
        <details className={styles.reminderMenu}>
          <summary>add a reminder</summary>
          <div className={styles.reminderOptions}>
            <a href={googleCalendarUrl} target="_blank" rel="noreferrer">
              <span>Google Calendar</span>
              <span aria-hidden>↗</span>
            </a>
            <a href={outlookCalendarUrl} target="_blank" rel="noreferrer">
              <span>Outlook Calendar</span>
              <span aria-hidden>↗</span>
            </a>
            <button type="button" onClick={addToCalendar} disabled={calendarSaved}>
              <span>{calendarSaved ? 'Calendar file ready' : 'Apple Calendar / other'}</span>
              <span aria-hidden>↓</span>
            </button>
          </div>
        </details>
        {calendarSaved && (
          <span className={styles.calendarHint} role="status">
            open the downloaded file to add its 15-minute reminder
          </span>
        )}
      </div>

      <p className={styles.hint}>come back when it&rsquo;s time.</p>
    </div>
  )
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'now'
  const totalSec = Math.floor(ms / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60

  // Two most-significant non-zero units: "3d 14h" reads better than the full breakdown when you
  // are waiting weeks. Drop to mm:ss in the last minute.
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${mins}m`
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}

function formatExact(d: Date): string {
  // Local-time formatting, so the recipient never reads "this opens at 3am" off a stored UTC value.
  return d.toLocaleString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
