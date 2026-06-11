import { useState } from 'react'
import type { FlowerSpec } from '../garden'
import styles from './FlowerLegend.module.css'

interface Props {
  flowers: FlowerSpec[]
  /**
   * AI-written one-sentence rationale for the whole bouquet. Surfaced
   * behind a "?" disclosure on the heading rather than displayed inline
   * — the per-flower meanings below already tell most of the story, and
   * a tap-to-reveal makes the combination rationale feel like a
   * deliberate "the AI thought about this" moment instead of yet
   * another paragraph of text.
   */
  bouquetNote?: string
}

/**
 * A legend listing every flower in the garden by name + meaning, with
 * a small stack of color swatches on the left so the visual ties back
 * to the bloom above. Shown by default — the per-flower meanings are
 * the AI's most personal output, and hiding them behind a tap means
 * most recipients never see them.
 *
 * The bouquetNote (overall rationale) IS hidden behind a tap, on a
 * "?" disclosure next to the heading. That's a different shape of
 * information from the per-flower meanings — broader, more abstract —
 * and giving it its own affordance keeps the legend visually clean
 * while still making the AI's reasoning discoverable.
 */
export default function FlowerLegend({ flowers, bouquetNote }: Props) {
  const [rationaleOpen, setRationaleOpen] = useState(false)
  const hasRationale = !!bouquetNote && bouquetNote.trim().length > 0

  return (
    <section className={styles.list} aria-label="What each flower means">
      <div className={styles.headingRow}>
        <p className={styles.heading}>why these</p>
        {hasRationale && (
          <button
            type="button"
            className={styles.rationaleToggle}
            onClick={() => setRationaleOpen(o => !o)}
            aria-expanded={rationaleOpen}
            aria-controls="flower-rationale"
            aria-label={rationaleOpen ? 'hide rationale' : 'show rationale'}
          >
            <span className={styles.rationaleToggleIcon}>?</span>
          </button>
        )}
      </div>

      {hasRationale && (
        <p
          id="flower-rationale"
          className={`${styles.rationale} ${rationaleOpen ? styles.rationaleOpen : ''}`}
          // Hidden from a11y tree when closed so screen readers don't
          // announce the empty rationale slot before it's revealed.
          aria-hidden={!rationaleOpen}
        >
          {bouquetNote}
        </p>
      )}

      <ul className={styles.items}>
        {flowers.map((f, i) => (
          <li
            key={`${i}-${f.name}`}
            className={styles.item}
            // Per-row stagger matches the GardenScene's per-flower
            // bloom timing (i * 380ms). In the Composer's designed
            // state the rows fade in as their corresponding flower
            // blooms above — the visual link between flower and
            // meaning becomes motion, not just spatial proximity.
            style={{ animationDelay: `${i * 380}ms` }}
          >
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
