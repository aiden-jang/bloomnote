import { FlowerHead } from './FlowerSVG'
import type { FlowerSpec } from '../garden'
import { BLOOM_STAGGER_MS } from './GardenScene'
import { withoutLeadingFlowerName } from '../lib/flowerMeaning'
import styles from './FlowerLegend.module.css'

interface Props {
  flowers: FlowerSpec[]
  focused?: number | null
  onFocus?: (index: number | null) => void
  onFocusRelease?: () => void
}

export default function FlowerLegend({ flowers, focused = null, onFocus, onFocusRelease }: Props) {
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
            onMouseLeave={() => onFocusRelease?.()}
            onClick={() => onFocus?.(focused === i ? null : i)}
            // Per-row stagger matches GardenScene's per-flower bloom timing, so a row fades in as its
            // flower opens above.
            style={{ animationDelay: `${i * BLOOM_STAGGER_MS}ms` }}
          >
            <span className={styles.bloom} aria-hidden>
              <FlowerHead flower={f} size={34} />
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
