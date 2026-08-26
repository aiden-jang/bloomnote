// Time-capsule schedule control. Lives below the message textarea in
// the composer form. Two states: collapsed (just the "schedule for
// later" link) and open (day + occasion quick-pick chips, a fully
// inline calendar, time-of-day chips with an exact-time fallback, plus
// the inline validation error).
//
// Why a custom inline calendar instead of <input type="datetime-local">:
// the native control pops an OS/browser calendar modal on click, which
// felt heavy and off-brand. Everything here renders inline in the card
// — no popups, no native date modal — and is styled to match the rest
// of the form.

import { useState } from 'react'
import styles from './Composer.module.css'

interface Props {
  /** True when the user has expanded the schedule UI. */
  open: boolean
  /** Current value as a local `YYYY-MM-DDTHH:mm` string. Empty when
   *  nothing is picked yet. */
  value: string
  /** Live validation error (null when OK or when input is empty). */
  error: string | null
  onOpen: () => void
  onChange: (value: string) => void
  onCancel: () => void
}

// --- date helpers ---------------------------------------------------

// Format a Date as the local `YYYY-MM-DDTHH:mm` string the rest of the
// app expects (the parent parses it with `new Date(...)`, which reads a
// TZ-less datetime as local time). Never use toISOString here — that
// emits UTC and shifts the value by the user's offset.
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

// `<input type="time">` speaks 24h `HH:mm`. These bridge it with the
// {h, m} time state.
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

// nth occurrence of a weekday in a month (e.g. 2nd Sunday of May). Used
// for the floating-date holidays.
function nthWeekday(year: number, month0: number, weekday: number, n: number): Date {
  const first = new Date(year, month0, 1)
  const shift = (weekday - first.getDay() + 7) % 7
  return new Date(year, month0, 1 + shift + (n - 1) * 7)
}

// Quick-pick times of day — the common picks. The exact-time input
// below the chips covers anything in between; each preset lands on a
// known time so its chip can highlight precisely when the current time
// matches. Morning (9am) is the shared default the occasion presets use.
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

// Friendly time for the confirmation line: a preset's label when the
// time matches one, otherwise a 12-hour clock string (e.g. "2:30 pm").
function timeLabel(h: number, m: number): string {
  const preset = TIME_OPTIONS.find((t) => t.h === h && t.m === m)
  if (preset) return preset.label
  const period = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

// Calendar moments to schedule around, each as a function from year →
// date. A mix of fixed-date and floating (nth-weekday) ones, kept dense
// across the year so there's always something coming up soon — not just
// the big holidays months out. Leans on relationship / appreciation +
// playful internet days, since that's the energy people send a garden
// with. Times default to morning at use sites.
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

// The next few occasions from now, soonest first — "whatever's coming up
// first." Each lands at 9am; if this year's date already passed, roll to
// next year so every chip is a valid future time.
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

  // Which month the calendar is showing. Seeds from the selected date
  // (so reopening with a value lands on the right month) or today.
  const [view, setView] = useState(() => {
    const seed = selected ?? new Date()
    return { year: seed.getFullYear(), month: seed.getMonth() }
  })

  // Selected time-of-day as {h, m}, seeded from the value's time or 9am.
  // The chips set canonical times; the exact-time input can set any.
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

  // Quick-pick chips. "today / tomorrow" are the near-term shortcuts the
  // calendar makes tedious; beyond that it's faster to tap the calendar,
  // so the remaining chips surface upcoming occasions instead (dates that
  // take effort to find by hand, e.g. the 2nd Sunday in May). Day chips
  // highlight by day (not exact time); occasions match their exact moment.
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dayChips = [
    {
      label: 'today',
      active: selected != null && sameDay(selected, today),
      // Only dead once every slot today has passed; before that, clicking
      // it bumps the time forward to a valid slot (see pickDayDate).
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

  // Earliest preset time slot on day `d` still in the future, or null if
  // the whole day's slots have passed (only possible for today).
  function soonestSlot(d: Date): { h: number; m: number } | null {
    const nowMs = Date.now()
    for (const t of TIME_OPTIONS) {
      if (atTime(d, t.h, t.m).getTime() > nowMs) return { h: t.h, m: t.m }
    }
    return null
  }

  // Pick a calendar day, keeping the current time of day — but if that
  // lands in the past (only possible for today), bump to the soonest
  // still-valid slot so switching to "today" never dead-ends.
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

  // Emit an occasion's exact date + time, syncing the calendar + chips.
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
    // Anchor the time to the chosen day, or — if none is picked yet —
    // to today, so setting a time always lands on a real datetime
    // instead of silently doing nothing.
    const base = selected ?? new Date()
    let next = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m)
    // When we auto-anchored to today and that moment has already passed,
    // roll to tomorrow so the pick is always a valid future time.
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

        {/* Quick-pick chips: today / tomorrow + the next few upcoming
            occasions. Tapping one sets both the day and the time. */}
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

        {/* Inline calendar — no native modal. */}
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

        {/* Time-of-day chips + an exact-time fallback. A chip lights up
            when the current time matches it; otherwise the time input
            holds the custom value. */}
        <div className={styles.scheduleTimeRow}>
          <span className={styles.scheduleAt}>at</span>
          <div className={styles.schedulePresets}>
            {TIME_OPTIONS.map((t) => {
              const active = t.h === time.h && t.m === time.m
              // When the chosen day is today, gray out times that have
              // already passed — they'd only make a past datetime.
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

        {/* Exact time — for a moment none of the chips cover. Feeds the
            same time state, so a chip lights up if you type its time. On
            today, `min` blocks earlier-than-now times. */}
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

        {/* Live confirmation of the combined day + time, so it's clear
            the pick took. Hidden while there's a validation error — the
            error message takes that slot instead. */}
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
