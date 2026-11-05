import styles from './Composer.module.css'

export default function ComposerSecret({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <details className={styles.secretNote} open={value.length > 0 ? true : undefined}>
      <summary>add a tiny secret</summary>
      <div className={styles.secretNoteField}>
        <label htmlFor="secret-note">a little aside they can tap to reveal</label>
        <textarea
          id="secret-note"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="p.s. I still have that ridiculous photo of us."
          rows={2}
          maxLength={140}
        />
        <span>{value.length}/140</span>
      </div>
    </details>
  )
}
