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
          /*
           * Pointer-only. Every flower above is a real button that produces the same highlight on
           * focus and on activation, so this row is a mouse shortcut and never the only way in.
           * Making it focusable would put a second tab stop on every flower.
           */
          // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
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
