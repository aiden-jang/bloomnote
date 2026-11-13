import ChipPicker from './ChipPicker'
import ScheduleInput from './ScheduleInput'
import GardenForecastPanel from './GardenForecastPanel'
import { MOODS } from '../lib/moods'
import { OCCASIONS } from '../lib/occasions'
import type { GardenForecast } from '../lib/gardenForecast'
import type { ComposerDraft } from '../lib/useComposerDraft'
import styles from './ComposerLetter.module.css'
import composer from './Composer.module.css'

export default function ComposerOptions({
  fields,
  set,
  forecast,
  scheduleError,
}: Pick<ComposerDraft, 'fields' | 'set'> & { forecast: GardenForecast; scheduleError: string | null }) {
  return (
    <div className={fields.scheduleOpen ? `${styles.options} ${styles.scheduled}` : styles.options}>
      <details className={composer.noteOptions}>
        <summary>occasion and mood</summary>
        <ChipPicker
          label="occasion"
          name="occasion"
          options={OCCASIONS}
          value={fields.occasion}
          onChange={set.occasion}
        />
        <ChipPicker label="mood" name="mood" options={MOODS} value={fields.mood} onChange={set.mood} />
        {fields.message.trim().length >= 4 && (
          <details className={styles.forecast}>
            <summary>what your words might grow</summary>
            <GardenForecastPanel forecast={forecast} />
          </details>
        )}
      </details>
      <ScheduleInput
        open={fields.scheduleOpen}
        value={fields.unlockLocal}
        error={scheduleError}
        onOpen={() => set.scheduleOpen(true)}
        onChange={set.unlockLocal}
        onCancel={() => {
          set.scheduleOpen(false)
          set.unlockLocal('')
        }}
      />
    </div>
  )
}
