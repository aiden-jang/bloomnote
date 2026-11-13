import type { ReactNode } from 'react'
import LetterHeader from './LetterHeader'
import styles from './ComposerFrame.module.css'

export default function ComposerFrame({
  intro,
  scene,
  preview,
  demo,
  writing,
  children,
  footer,
}: {
  intro: string | undefined
  scene: ReactNode
  preview: ReactNode
  demo: boolean
  writing: boolean
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className={styles.wrap} data-letter-page="writing">
      <LetterHeader brandHeading />
      <div className={`${styles.studio} ${writing ? styles.writing : ''}`}>
        <div className={styles.workspace}>
          {intro && (
            <div className={styles.intro}>
              <h2 className={styles.headline}>
                A few words.
                <br />
                <em>A little garden.</em>
              </h2>
              <p className={styles.subtitle}>{intro}</p>
            </div>
          )}
          {children}
        </div>
        {demo && (
          <aside className={styles.garden} aria-label="Garden preview">
            <div className={demo ? styles.demoSpecimen : undefined}>
              <div className={styles.specimenLabel}>
                <span>{demo ? 'example garden' : 'your garden'}</span>
                <span aria-hidden>✳</span>
              </div>
              {scene}
              {demo && <p className={styles.caption}>No watering required. Emotionally, anyway.</p>}
            </div>
          </aside>
        )}
        {preview && <div className={styles.preview}>{preview}</div>}
      </div>
      {footer}
    </div>
  )
}
