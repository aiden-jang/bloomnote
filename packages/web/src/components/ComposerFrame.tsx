import type { ReactNode } from 'react'
import SoundToggle from './SoundToggle'
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
          <a href="/" aria-label="bloomnote home">
            bloomnote<span aria-hidden>✳</span>
          </a>
        </h1>
      </header>
      <div className={styles.studio}>
        <aside className={styles.garden} aria-label="Garden preview">
          <p className={styles.kicker}>a small gesture, overgrown</p>
          <h2 className={styles.headline}>
            A little note.
            <br />
            <em>A whole garden.</em>
          </h2>
          <p className={styles.subtitle}>{subtitle}</p>
          <div className={styles.specimen}>
            <div className={styles.specimenLabel}>
              <span>{demo ? 'example garden' : 'your garden'}</span>
              <span aria-hidden>↗</span>
            </div>
            {scene}
            <p className={styles.caption}>No watering required. Emotionally, anyway.</p>
          </div>
          <p className={styles.how}>Your words. Flowers chosen for them. A link worth opening.</p>
        </aside>
        <div className={styles.workspace}>{children}</div>
      </div>
    </div>
  )
}
