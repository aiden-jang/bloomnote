import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import styles from './Composer.module.css'

type CalendarMonth = { year: number; month: number }

interface Props {
  today: Date
  selected: Date | null
  view: CalendarMonth
  onViewChange: (month: CalendarMonth) => void
  onPick: (date: Date) => void
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function ScheduleCalendar({ today, selected, view, onViewChange, onPick }: Props) {
  const [focusedDate, setFocusedDate] = useState<Date | null>(null)
  const dayButton = useRef<HTMLButtonElement>(null)
  const moveFocus = useRef(false)
  useLayoutEffect(() => {
    if (!moveFocus.current) return
    moveFocus.current = false
    dayButton.current?.focus()
  }, [focusedDate])

  function shiftMonth(delta: number) {
    const next = new Date(view.year, view.month + delta, 1)
    onViewChange({ year: next.getFullYear(), month: next.getMonth() })
  }

  // Can't navigate to a month entirely in the past.
  const atCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth()

  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const weeksInMonth = Math.ceil((firstWeekday + daysInMonth) / 7)
  const canFocusInMonth = (date: Date | null): date is Date =>
    date != null && date >= today && date.getFullYear() === view.year && date.getMonth() === view.month
  const tabDay = canFocusInMonth(focusedDate)
    ? focusedDate.getDate()
    : canFocusInMonth(selected)
      ? selected.getDate()
      : atCurrentMonth
        ? today.getDate()
        : 1
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  function navigateDays(event: KeyboardEvent<HTMLButtonElement>, date: Date) {
    const next = new Date(date)
    switch (event.key) {
      case 'ArrowLeft':
        next.setDate(date.getDate() - 1)
        break
      case 'ArrowRight':
        next.setDate(date.getDate() + 1)
        break
      case 'ArrowUp':
        next.setDate(date.getDate() - 7)
        break
      case 'ArrowDown':
        next.setDate(date.getDate() + 7)
        break
      case 'Home':
        next.setDate(date.getDate() - date.getDay())
        break
      case 'End':
        next.setDate(date.getDate() + 6 - date.getDay())
        break
      case 'PageUp':
      case 'PageDown': {
        const delta = (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)
        next.setMonth(date.getMonth() + delta, 1)
        const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
        next.setDate(Math.min(date.getDate(), last))
        break
      }
      default:
        return
    }
    event.preventDefault()
    const target = next < today ? today : next
    if (sameDay(date, target)) return
    moveFocus.current = true
    onViewChange({ year: target.getFullYear(), month: target.getMonth() })
    setFocusedDate(target)
  }

  return (
    <div className={styles.scheduleCalendar}>
      <div className={styles.calHeader}>
        <button
          type="button"
          className={styles.calNav}
          onClick={() => shiftMonth(-1)}
          disabled={atCurrentMonth}
          aria-label="previous month"
        >
          ‹
        </button>
        <span className={styles.calMonthLabel} aria-live="polite">
          {monthLabel}
        </span>
        <button type="button" className={styles.calNav} onClick={() => shiftMonth(1)} aria-label="next month">
          ›
        </button>
      </div>

      <div className={styles.calGrid} role="grid" aria-label={`Choose a date in ${monthLabel}`}>
        <div role="row" className={styles.calRow}>
          {WEEKDAYS.map((weekday) => (
            <span key={weekday} role="columnheader" className={styles.calWeekday} aria-label={weekday}>
              {weekday[0]}
            </span>
          ))}
        </div>
        {Array.from({ length: weeksInMonth }, (_, week) => (
          <div key={week} role="row" className={styles.calRow}>
            {WEEKDAYS.map((weekday, index) => {
              const day = week * 7 + index + 1 - firstWeekday
              if (day < 1 || day > daysInMonth) return <span key={weekday} role="gridcell" />
              const date = new Date(view.year, view.month, day)
              const isSel = selected != null && sameDay(selected, date)
              const isToday = sameDay(today, date)
              return (
                <div key={weekday} role="gridcell" aria-selected={isSel}>
                  <button
                    ref={day === tabDay ? dayButton : undefined}
                    tabIndex={day === tabDay ? 0 : -1}
                    type="button"
                    disabled={date < today}
                    onClick={() => onPick(date)}
                    onFocus={() => setFocusedDate(date)}
                    onKeyDown={(event) => navigateDays(event, date)}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={date.toLocaleDateString(undefined, { dateStyle: 'full' })}
                    className={`${styles.calDay} ${isSel ? styles.calDaySelected : ''} ${
                      isToday ? styles.calToday : ''
                    }`}
                  >
                    {day}
                  </button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
