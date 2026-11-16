import { occasionTone } from '../lib/occasions'
import { useState, type RefObject } from 'react'
import { charCountTierClass } from '../lib/composerHelpers'
import type { Ritual } from '../lib/rituals'
import styles from './Composer.module.css'
import letter from './ComposerLetter.module.css'

const MAX_NOTE = 400

interface NoteFieldProps {
  occasion: string
  ritual: Ritual
  value: string
  onChange: (value: string) => void
  inputRef: RefObject<HTMLTextAreaElement>
  prompt: string
  hasAnotherPrompt: boolean
  onAnotherPrompt: () => void
}

export default function NoteField({
  occasion,
  ritual,
  value,
  onChange,
  inputRef,
  prompt,
  hasAnotherPrompt,
  onAnotherPrompt,
}: NoteFieldProps) {
  const [focused, setFocused] = useState(false)
  const showRitual = !value.trim() && !focused
  return (
    <section className={`${styles.section} ${letter.note}`}>
      {/* htmlFor and id, not adjacency. Every label on this form sits beside its input rather
          than wrapping it, so without the pairing each field's only name is its placeholder. */}
      <label className={styles.label} htmlFor="note">
        your note
      </label>
      <textarea
        id="note"
        name="note"
        ref={inputRef}
        className={styles.textarea}
        placeholder={prompt}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        maxLength={MAX_NOTE}
        aria-describedby="note-hint note-count"
      />
      <div className={`${styles.helperRow} ${letter.guidance}`}>
        <p id="note-hint" className={styles.helper}>
          {showRitual ? (
            <>
              {ritual.invitation}
              {ritual.permission && <span>{ritual.permission}</span>}
            </>
          ) : occasionTone(occasion) === 'ordinary' ? (
            'One specific detail goes a long way.'
          ) : (
            'A short note is enough.'
          )}
        </p>
        <span id="note-count" className={`${styles.charCount} ${charCountTierClass(value.length, styles)}`}>
          {value.length}/{MAX_NOTE}
        </span>
      </div>
      {!value.trim() && (
        <div className={`${styles.promptRow} ${letter.prompts}`}>
          <button
            type="button"
            className={`${styles.promptLink} ${letter.promptAction}`}
            onClick={() => {
              onChange(prompt)
              inputRef.current?.focus()
            }}
          >
            use this thought
          </button>
          {hasAnotherPrompt && (
            <button
              type="button"
              className={`${styles.promptLink} ${letter.promptAction}`}
              onClick={onAnotherPrompt}
            >
              another thought ↻
            </button>
          )}
        </div>
      )}
    </section>
  )
}
