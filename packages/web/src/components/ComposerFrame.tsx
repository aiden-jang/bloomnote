import type { ReactNode } from 'react'
import SoundToggle from './SoundToggle'
import BloomBrand from './BloomBrand'
import styles from './ComposerFrame.module.css'

export default function ComposerFrame({
  intro,
  scene,
  preview,
  demo,
  children,
  footer,
}: {
  intro: string | undefined
  scene: ReactNode
  preview: ReactNode
  demo: boolean
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <div className={styles.wrap}>
      <SoundToggle />
      <header className={styles.header}>
        <h1 className={styles.wordmark}>
          <BloomBrand />
        </h1>
      </header>
      <div className={`${styles.studio} ${preview ? styles.finished : ''}`}>
        <div className={styles.workspace}>
          {intro && (
            <div className={styles.intro}>
              <h2 className={styles.headline}>What do you want to tell them?</h2>
              <p className={styles.subtitle}>{intro}</p>
            </div>
          )}
          {children}
        </div>
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
        {preview && <div className={styles.preview}>{preview}</div>}
      </div>
      {footer}
    </div>
  )
}
