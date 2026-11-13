import type { CSSProperties, ReactNode } from 'react'
import ComposerSecret from './ComposerSecret'
import type { ComposerDraft } from '../lib/useComposerDraft'
import styles from './ComposerLetter.module.css'

export default function ComposerLetter({
  fields,
  set,
  children,
}: Pick<ComposerDraft, 'fields' | 'set'> & { children: ReactNode }) {
  return (
    <div className={styles.letter}>
      <div className={styles.greeting}>
        <label htmlFor="garden-to">Dear</label>
        <input
          id="garden-to"
          aria-label="to"
          placeholder="their name"
          value={fields.recipient}
          onChange={(event) => set.recipient(event.target.value)}
          maxLength={60}
          style={{ '--name-length': Math.max(4, fields.recipient.length || 10) } as CSSProperties}
        />
        <span aria-hidden>,</span>
      </div>
      {children}
      <div className={styles.bottom}>
        <div className={styles.signature}>
          <label htmlFor="garden-from">
            from <span>(optional)</span>
          </label>
          <input
            id="garden-from"
            placeholder="your name"
            value={fields.from}
            onChange={(event) => set.from(event.target.value)}
            maxLength={60}
            autoComplete="given-name"
          />
        </div>
        <ComposerSecret value={fields.secret} onChange={set.secret} />
      </div>
    </div>
  )
}
