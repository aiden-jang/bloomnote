import type { FlowerSpec } from '../garden'
import styles from './FlowerLegend.module.css'

interface Props {
  flowers: FlowerSpec[]
}

/**
 * A legend listing every flower in the garden by name + meaning, with
 * a small stack of color swatches on the left so the visual ties back
 * to the bloom above. Shown by default — the per-flower meanings are
 * the AI's most personal output, and hiding them behind a tap means
 * most recipients never see them.
 *
 * The flower-tap popover (FlowerCard) still exists for when you want
 * to inspect one flower in isolation. The legend is the at-a-glance
 * view of the whole bouquet.
 */
export default function FlowerLegend({ flowers }: Props) {
  return (
    <section className={styles.list} aria-label="What each flower means">
      <p className={styles.heading}>What each flower means</p>
      <ul className={styles.items}>
        {flowers.map((f, i) => (
          <li key={`${i}-${f.name}`} className={styles.item}>
            <span className={styles.swatchStack} aria-hidden>
              {f.petalColors.map((c, j) => (
                <span key={j} className={styles.swatch} style={{ background: c }} />
              ))}
            </span>
            <div className={styles.text}>
              <p className={styles.name}>{f.name}</p>
              <p className={styles.meaning}>{f.meaning}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
