import type { ReactNode } from 'react'
import SoundToggle from './SoundToggle'
import BloomBrand from './BloomBrand'
import styles from './ComposerFrame.module.css'

export default function ComposerFrame({
  subtitle,
  scene,
  demo,
  children,
}: {
  subtitle: string
  scene: ReactNode
  demo: boolean
  children: ReactNode
}) {
  return (
    <div className={styles.wrap}>
      <SoundToggle />
      <header className={styles.header}>
        <h1 className={styles.wordmark}>
          <BloomBrand />
        </h1>
      </header>
      <div className={styles.studio}>
        <div className={styles.workspace}>
          <p className={styles.kicker}>A NOTE FOR SOMEONE</p>
          <h2 className={styles.headline}>
            What do you want
            <br />
            <em>to tell them?</em>
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
          {children}
        </div>
        <aside className={styles.garden} aria-label="Garden preview">
          <div className={`${styles.specimen} ${demo ? styles.demoSpecimen : ''}`}>
            <div className={styles.specimenLabel}>
              <span>{demo ? 'example garden' : 'your garden'}</span>
              <span aria-hidden>✳</span>
            </div>
            {scene}
            <p className={styles.caption}>No watering required. Emotionally, anyway.</p>
          </div>
          <p className={styles.how}>Your words decide what grows here.</p>
        </aside>
      </div>
    </div>
  )
}
