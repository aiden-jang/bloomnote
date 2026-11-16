import { occasionTone } from '../lib/occasions'
import styles from './Composer.module.css'

export default function ComposerSecret({
  occasion,
  value,
  onChange,
}: {
  occasion: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <details className={styles.secretNote} open={value.length > 0 ? true : undefined}>
      <summary>add a secret</summary>
      <div className={styles.secretNoteField}>
        <label htmlFor="secret-note">a little aside they can tap to reveal</label>
        <textarea
          id="secret-note"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            occasionTone(occasion) === 'ordinary'
              ? 'p.s. there was one more thing.'
              : 'One more thing you’d like them to know.'
          }
          rows={2}
          maxLength={140}
        />
        <span>{value.length}/140</span>
      </div>
    </details>
  )
}
