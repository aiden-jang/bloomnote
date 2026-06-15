// Time-capsule schedule control. Lives below the message textarea in
// the composer form. Two states: collapsed (just the "schedule for
// later" link) and open (the datetime input + cancel link, plus the
// inline validation error when the picked time is in the past).

import styles from './Composer.module.css'

interface Props {
  /** True when the user has expanded the schedule UI. */
  open: boolean
  /** Current value of the datetime-local input. Empty string when
   *  not yet picked. */
  value: string
  /** Live validation error (null when OK or when input is empty). */
  error: string | null
  onOpen: () => void
  onChange: (value: string) => void
  onCancel: () => void
}

export default function ScheduleInput({
  open,
  value,
  error,
  onOpen,
  onChange,
  onCancel,
}: Props) {
  return (
    <section className={styles.schedule}>
      {!open ? (
        <button type="button" className={styles.scheduleToggle} onClick={onOpen}>
          or schedule for later →
        </button>
      ) : (
        <div className={styles.scheduleBlock}>
          <div className={styles.scheduleOpen}>
            <label className={styles.scheduleLabel}>opens on</label>
            <input
              type="datetime-local"
              className={`${styles.scheduleInput} ${error ? styles.scheduleInputError : ''}`}
              value={value}
              onChange={e => onChange(e.target.value)}
              // `min` is best-effort — some mobile pickers ignore it.
              // The real validation lives in the parent's scheduleError.
              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
              aria-invalid={error !== null}
              aria-describedby={error ? 'schedule-error' : undefined}
            />
            <button type="button" className={styles.scheduleClear} onClick={onCancel}>
              cancel
            </button>
          </div>
          {error && (
            <p id="schedule-error" className={styles.scheduleErrorText}>
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  )
}
