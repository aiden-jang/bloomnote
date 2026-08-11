import type { FlowerSpec } from '../garden'
import { BLOOM_STAGGER_MS } from './GardenScene'
import { withoutLeadingFlowerName } from '../lib/flowerMeaning'
import styles from './FlowerLegend.module.css'

interface Props {
  flowers: FlowerSpec[]
  /** Index of the flower being looked at, whether from here or from the plot above. */
  focused?: number | null
  /** Pointing at a row, or letting go of it. */
  onFocus?: (index: number | null) => void
}

/**
 * A legend listing every flower in the garden by name + meaning, with
 * a small stack of color swatches on the left so the visual ties back
 * to the bloom above. Shown by default — the per-flower meanings are
 * the AI's most personal output, and hiding them behind a tap means
 * most recipients never see them.
 *
 * The overall bouquet rationale now lives in BouquetNote (attached to
 * the message with a typewriter reveal), so this component is purely
 * the per-flower breakdown.
 */
export default function FlowerLegend({ flowers, focused = null, onFocus }: Props) {
  return (
    <section className={styles.list} aria-label="What each flower means">
      <p className={styles.heading}>what they mean</p>

      <ul className={styles.items}>
        {flowers.map((f, i) => (
          <li
            key={`${i}-${f.name}`}
            className={
              focused === i
                ? `${styles.item} ${styles.itemOn}`
                : focused !== null
                  ? `${styles.item} ${styles.itemOff}`
                  : styles.item
            }
            onMouseEnter={() => onFocus?.(i)}
            onMouseLeave={() => onFocus?.(null)}
            onClick={() => onFocus?.(focused === i ? null : i)}
            // Per-row stagger matches the GardenScene's per-flower
            // bloom timing — rows fade in as their corresponding
            // flower blooms above.
            style={{ animationDelay: `${i * BLOOM_STAGGER_MS}ms` }}
          >
            <span className={styles.swatchStack} aria-hidden>
              {f.petalColors.map((c, j) => (
                <span key={j} className={styles.swatch} style={{ background: c }} />
              ))}
            </span>
            <div className={styles.text}>
              <p className={styles.name}>{f.name}</p>
              <p className={styles.meaning}>{withoutLeadingFlowerName(f.name, f.meaning)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
