import type { RefObject } from 'react'
import { charCountTierClass } from '../lib/composerHelpers'
import type { Ritual } from '../lib/rituals'
import styles from './Composer.module.css'

const MAX_NOTE = 400

interface NoteFieldProps {
  ritual: Ritual
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLTextAreaElement>
  prompt: string
  hasAnotherPrompt: boolean
  onAnotherPrompt: () => void
}

export default function NoteField({
  ritual,
  value,
  onChange,
  inputRef,
  prompt,
  hasAnotherPrompt,
  onAnotherPrompt,
}: NoteFieldProps) {
  return (
    <section className={styles.section}>
      {/* htmlFor and id, not adjacency. Every label on this form sits beside its input rather
          than wrapping it, so without the pairing each field's only name is its placeholder. */}
      <label className={styles.label} htmlFor="note">
        your note
      </label>
      <p className={styles.ritual}>
        {ritual.invitation}
        {ritual.permission && <span>{ritual.permission}</span>}
      </p>
      <textarea
        id="note"
        ref={inputRef}
        className={styles.textarea}
        placeholder={prompt}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        maxLength={MAX_NOTE}
      />
      <div className={styles.helperRow}>
        <span className={styles.helper}>
          quirks beat vibes. the weirder the detail, the better the bouquet.
        </span>
        <span className={`${styles.charCount} ${charCountTierClass(value.length, styles)}`}>
          {value.length}/{MAX_NOTE}
        </span>
      </div>
      {!value.trim() && (
        <div className={styles.promptRow}>
          <button
            type="button"
            className={styles.promptLink}
            onClick={() => {
              onChange(prompt)
              inputRef.current?.focus()
            }}
          >
            use this thought
          </button>
          {hasAnotherPrompt && (
            <button type="button" className={styles.promptLink} onClick={onAnotherPrompt}>
              another angle ↻
            </button>
          )}
        </div>
      )}
    </section>
  )
}
