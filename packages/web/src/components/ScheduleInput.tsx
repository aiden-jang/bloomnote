// A custom inline calendar rather than <input type="datetime-local">: the native control pops
// an OS modal on click. Everything here renders inline in the card.

import { useState } from 'react'
import styles from './Composer.module.css'

interface Props {
  open: boolean
  value: string
  error: string | null
  onOpen: () => void
  onChange: (value: string) => void
  onCancel: () => void
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function parseLocal(value: string): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!m) return null
  return new Date(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, 0, 0)
}

function toTimeInputValue(h: number, m: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}`
}

function parseTimeInput(s: string): { h: number; m: number } | null {
  const mm = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!mm) return null
  const h = +mm[1]!
  const m = +mm[2]!
  if (h > 23 || m > 59) return null
  return { h, m }
}

function startOfDay(d: Date): Date {
  const n = new Date(d)
  n.setHours(0, 0, 0, 0)
  return n
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(year, month0, 1)
  const shift = (weekday - first.getDay() + 7) % 7
  return new Date(year, month0, 1 + shift + (n - 1) * 7)
}

const TIME_OPTIONS = [
  { label: 'morning', h: 9, m: 0 },
  { label: 'noon', h: 12, m: 0 },
  { label: 'afternoon', h: 15, m: 0 },
  { label: 'evening', h: 18, m: 0 },
  { label: 'night', h: 21, m: 0 },
] as const

function atTime(d: Date, h: number, m: number): Date {
  const n = new Date(d)
  n.setHours(h, m, 0, 0)
  return n
}

function timeLabel(h: number, m: number): string {
  const preset = TIME_OPTIONS.find((t) => t.h === h && t.m === m)
  if (preset) return preset.label
  const period = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

const OCCASIONS: { label: string; forYear: (y: number) => Date }[] = [
  { label: "new year's", forYear: (y) => new Date(y, 0, 1) },
  { label: "galentine's", forYear: (y) => new Date(y, 1, 13) },
  { label: "valentine's day", forYear: (y) => new Date(y, 1, 14) },
  { label: "st. patrick's", forYear: (y) => new Date(y, 2, 17) },
  { label: "april fools'", forYear: (y) => new Date(y, 3, 1) },
  { label: 'may the 4th', forYear: (y) => new Date(y, 4, 4) },
  { label: "mother's day", forYear: (y) => nthWeekday(y, 4, 0, 2) },
  { label: 'best friends day', forYear: (y) => new Date(y, 5, 8) },
  { label: "father's day", forYear: (y) => nthWeekday(y, 5, 0, 3) },
  { label: 'friendship day', forYear: (y) => new Date(y, 6, 30) },
  { label: 'girlfriends day', forYear: (y) => new Date(y, 7, 1) },
  { label: 'dog day', forYear: (y) => new Date(y, 7, 26) },
  { label: 'daughters day', forYear: (y) => new Date(y, 8, 25) },
  { label: 'boyfriend day', forYear: (y) => new Date(y, 9, 3) },
  { label: 'halloween', forYear: (y) => new Date(y, 9, 31) },
  { label: 'thanksgiving', forYear: (y) => nthWeekday(y, 10, 4, 4) },
  { label: 'christmas', forYear: (y) => new Date(y, 11, 25) },
]

function upcomingOccasions(count: number): { label: string; date: Date }[] {
  const now = Date.now()
  const thisYear = new Date().getFullYear()
  return OCCASIONS.map((o) => {
    let date = atTime(o.forYear(thisYear), 9, 0)
    if (date.getTime() <= now) date = atTime(o.forYear(thisYear + 1), 9, 0)
    return { label: o.label, date }
  })
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, count)
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function ScheduleInput({ open, value, error, onOpen, onChange, onCancel }: Props) {
  const selected = parseLocal(value)
  const today = startOfDay(new Date())

  const [view, setView] = useState(() => {
    const seed = selected ?? new Date()
    return { year: seed.getFullYear(), month: seed.getMonth() }
  })

  const [time, setTime] = useState<{ h: number; m: number }>(() =>
    selected ? { h: selected.getHours(), m: selected.getMinutes() } : { h: 9, m: 0 },
  )

  if (!open) {
    return (
      <section className={styles.schedule}>
        <button type="button" className={styles.scheduleToggle} onClick={onOpen}>
          or schedule for later →
        </button>
      </section>
    )
  }

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayChips = [
    {
      label: 'today',
      active: selected != null && sameDay(selected, today),
      // Only dead once every slot today has passed. Before that, clicking it bumps the time forward.
      disabled: soonestSlot(today) == null,
      onClick: () => pickDayDate(today),
    },
    {
      label: 'tomorrow',
      active: selected != null && sameDay(selected, tomorrow),
      disabled: false,
      onClick: () => pickDayDate(tomorrow),
    },
  ]
  const occasionChips = upcomingOccasions(4).map((o) => ({
    label: o.label,
    active: value === toLocalInputValue(o.date),
    disabled: false,
    onClick: () => pickPreset(o.date),
  }))
  const presetChips = [...dayChips, ...occasionChips]

  function soonestSlot(d: Date): { h: number; m: number } | null {
    const nowMs = Date.now()
    for (const t of TIME_OPTIONS) {
      if (atTime(d, t.h, t.m).getTime() > nowMs) return { h: t.h, m: t.m }
    }
    return null
  }

  // Keep the current time of day, but if that lands in the past (only possible on today), move to
  // the next slot that hasn't gone.
  function pickDayDate(d: Date) {
    let { h, m } = time
    if (atTime(d, h, m).getTime() <= Date.now()) {
      const slot = soonestSlot(d)
      if (!slot) return
      h = slot.h
      m = slot.m
    }
    setTime({ h, m })
    onChange(toLocalInputValue(atTime(d, h, m)))
    setView({ year: d.getFullYear(), month: d.getMonth() })
  }

  function pickPreset(date: Date) {
    onChange(toLocalInputValue(date))
    setView({ year: date.getFullYear(), month: date.getMonth() })
    setTime({ h: date.getHours(), m: date.getMinutes() })
  }

  function pickDay(day: number) {
    pickDayDate(new Date(view.year, view.month, day))
  }

  function pickTime(h: number, m: number) {
    setTime({ h, m })
    // Anchor the time to the chosen day, or to today when none is picked, so setting a time alone
    // still produces a datetime. If today's moment has already passed, roll to tomorrow.
    const base = selected ?? new Date()
    let next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m)
    if (!selected && next.getTime() <= Date.now()) {
      next = new Date(next.getFullYear(), next.getMonth(), next.getDate() + 1, h, m)
    }
    onChange(toLocalInputValue(next))
    setView({ year: next.getFullYear(), month: next.getMonth() })
  }

  function pickExactTime(input: string) {
    const parsed = parseTimeInput(input)
    if (parsed) pickTime(parsed.h, parsed.m)
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  // Can't navigate to a month entirely in the past.
  const atCurrentMonth = view.year === today.getFullYear() && view.month === today.getMonth()

  const firstWeekday = new Date(view.year, view.month, 1).getDay()
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <section className={styles.schedule}>
      <div className={styles.scheduleBlock}>
        <div className={styles.scheduleHead}>
          <span className={styles.scheduleTitle}>when should it open?</span>
          <button type="button" className={styles.scheduleClear} onClick={onCancel}>
            cancel
          </button>
        </div>

        <div className={styles.schedulePresets}>
          {presetChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={chip.disabled}
              className={`${styles.presetChip} ${chip.active ? styles.presetChipActive : ''}`}
              aria-pressed={chip.active}
              onClick={chip.onClick}
            >
              {chip.label}
            </button>
          ))}
        </div>

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
            <span className={styles.calMonthLabel}>{monthLabel}</span>
            <button
              type="button"
              className={styles.calNav}
              onClick={() => shiftMonth(1)}
              aria-label="next month"
            >
              ›
            </button>
          </div>

          <div className={styles.calGrid} role="grid">
            {WEEKDAYS.map((w, i) => (
              <span key={`wd-${i}`} className={styles.calWeekday} aria-hidden>
                {w}
              </span>
            ))}
            {Array.from({ length: firstWeekday }).map((_, i) => (
              <span key={`pad-${i}`} className={styles.calEmpty} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const date = new Date(view.year, view.month, day)
              const disabled = date < today
              const isSel = selected != null && sameDay(selected, date)
              const isToday = sameDay(today, date)
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => pickDay(day)}
                  aria-pressed={isSel}
                  aria-label={date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                  })}
                  className={`${styles.calDay} ${isSel ? styles.calDaySelected : ''} ${
                    isToday ? styles.calToday : ''
                  }`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>

        <div className={styles.scheduleTimeRow}>
          <span className={styles.scheduleAt}>at</span>
          <div className={styles.schedulePresets}>
            {TIME_OPTIONS.map((t) => {
              const active = t.h === time.h && t.m === time.m
              // On today, grey out times that have already passed. They could only make a past datetime.
              const past =
                selected != null &&
                sameDay(selected, today) &&
                atTime(selected, t.h, t.m).getTime() <= Date.now()
              return (
                <button
                  key={t.label}
                  type="button"
                  disabled={past}
                  className={`${styles.presetChip} ${active ? styles.presetChipActive : ''}`}
                  aria-pressed={active}
                  onClick={() => pickTime(t.h, t.m)}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <label className={styles.scheduleExact}>
          <span className={styles.scheduleAt}>or exact</span>
          <input
            type="time"
            className={styles.scheduleTimeInput}
            value={toTimeInputValue(time.h, time.m)}
            min={
              selected != null && sameDay(selected, today)
                ? toTimeInputValue(new Date().getHours(), new Date().getMinutes())
                : undefined
            }
            onChange={(e) => pickExactTime(e.target.value)}
            aria-label="exact time"
          />
        </label>

        {selected && !error && (
          <p className={styles.scheduleSummary}>
            opens{' '}
            {selected.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}{' '}
            · {timeLabel(selected.getHours(), selected.getMinutes())}
          </p>
        )}

        {error && (
          <p id="schedule-error" className={styles.scheduleErrorText}>
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
