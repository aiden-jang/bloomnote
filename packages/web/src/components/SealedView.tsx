import LetterHeader from './LetterHeader'
import GiftPacketArt from './GiftPacketArt'
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
    const onShow = () => {
      if (!document.hidden) tick()
    }
    document.addEventListener('visibilitychange', onShow)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onShow)
    }
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
    <div className={styles.wrap} data-letter-page="scheduled">
      <LetterHeader />
      <div className={styles.body}>
        <div className={styles.topLabel}>
          <h1 className={styles.title}>A garden is waiting.</h1>
          <p className={styles.fromText}>
            {from || 'Someone'} made {to || 'you'} a garden.
          </p>
        </div>

        <section className={styles.paper}>
          <div className={styles.plot} aria-hidden>
            <div className={styles.envelope}>
              <GiftPacketArt />
            </div>
          </div>
          <h2 className={styles.greeting}>
            For {to || 'you'},<br />
            <em>a little later.</em>
          </h2>
          <p className={styles.opensExact}>{formatExact(unlockDate)}</p>
          <div className={styles.countdown}>
            <p className={styles.opensLabel}>opens in</p>
            <div className={styles.opensRelative} role="timer" aria-label="Time until garden opens">
              {formatRemaining(remaining)
                .split(' ')
                .map((part) => {
                  const unit = part.slice(-1)
                  const label = (
                    { d: 'days', h: 'hours', m: 'minutes', s: 'seconds' } as Record<string, string>
                  )[unit]
                  if (!label) return <span key={part}>{part}</span>
                  const value = Number(part.slice(0, -1))
                  return (
                    <span key={unit}>
                      <strong>{value.toLocaleString()}</strong>
                      <small>{value === 1 ? label.slice(0, -1) : label}</small>
                    </span>
                  )
                })}
            </div>
          </div>
          <p className={styles.hint}>Come back when it opens.</p>
          <details className={styles.reminderMenu}>
            <summary>add a reminder</summary>
            <div className={styles.reminderOptions}>
              <a
                href={googleCalendarUrl}
                target="_blank"
                aria-describedby="external-link-hint"
                rel="noreferrer"
              >
                <span>Google Calendar</span>
                <span aria-hidden>↗</span>
              </a>
              <a
                href={outlookCalendarUrl}
                target="_blank"
                aria-describedby="external-link-hint"
                rel="noreferrer"
              >
                <span>Outlook Calendar</span>
                <span aria-hidden>↗</span>
              </a>
              <button type="button" onClick={addToCalendar} disabled={calendarSaved}>
                <span>{calendarSaved ? 'calendar file ready' : 'Apple Calendar / other'}</span>
                <span aria-hidden>↓</span>
              </button>
            </div>
          </details>
          {calendarSaved && (
            <span className={styles.calendarHint} role="status">
              Open the downloaded file to add its 15-minute reminder.
            </span>
          )}
        </section>
      </div>
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
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
