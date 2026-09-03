import ChipRow from './ChipRow'
import styles from './Composer.module.css'

interface ChipPickerProps {
  label: string
  /** Also the id prefix for the group's label, so it has to be unique on the page. */
  name: string
  options: readonly { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

export default function ChipPicker({ label, name, options, value, onChange }: ChipPickerProps) {
  const labelId = `${name}-label`
  return (
    <section className={styles.section}>
      <span className={styles.label} id={labelId}>
        {label}
      </span>
      <ChipRow labelledBy={labelId}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            className={value === option.value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </ChipRow>
    </section>
  )
}
