import { occasionTone } from '../lib/occasions'
import type { ReactNode } from 'react'
import type { FlowerSpec } from '../garden'
import FlowerSVG from './FlowerSVG'
import LetterHeader from './LetterHeader'
import styles from './ComposerFrame.module.css'

export default function ComposerFrame({
  intro,
  occasion,
  flowers,
  preview,
  demo,
  writing,
  children,
  footer,
}: {
  intro: string | undefined
  occasion: string
  flowers: FlowerSpec[]
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
              <div className={styles.introCopy}>
                <h2 className={styles.headline}>
                  A note.
                  <br />
                  <em>With flowers.</em>
                </h2>
                <p className={styles.subtitle}>{intro}</p>
              </div>
              {demo && (
                <aside className={styles.specimen} aria-label="Garden preview">
                  <div className={styles.flowers} aria-hidden="true">
                    {flowers.slice(0, 4).map((flower, index) => (
                      <span key={`${flower.name}-${index}`}>
                        <FlowerSVG flower={flower} index={index} bloomed staticRender />
                      </span>
                    ))}
                  </div>
                  <p className={styles.specimenLabel}>example garden</p>
                  <p className={styles.caption}>
                    {occasionTone(occasion) === 'ordinary' ? 'No vase required.' : 'A garden for your note.'}
                  </p>
                </aside>
              )}
            </div>
          )}
          {children}
        </div>
        {preview && <div className={styles.preview}>{preview}</div>}
      </div>
      {footer}
    </div>
  )
}
