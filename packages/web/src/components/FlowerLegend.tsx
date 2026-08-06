import type { FlowerSpec } from '../garden'
import { BLOOM_STAGGER_MS } from './GardenScene'
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
 * The overall bouquet rationale now lives in BouquetNote (attached to
 * the message with a typewriter reveal), so this component is purely
 * the per-flower breakdown.
 */
export default function FlowerLegend({ flowers }: Props) {
  return (
    <section className={styles.list} aria-label="What each flower means">
      <p className={styles.heading}>what they mean</p>

      <ul className={styles.items}>
        {flowers.map((f, i) => (
          <li
            key={`${i}-${f.name}`}
            className={styles.item}
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
              <p className={styles.meaning}>{withoutLeadingName(f.name, f.meaning)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Drop a leading "Rose, " / "Rose " from a meaning, since the name is already the line above it.
 *
 * The model was told to write these as standalone phrases, but the prompt's own example used to
 * include the name, so gardens generated before that was fixed read "Lavender / Lavender, for the
 * calm you bring into every room." Those are stored and immutable, and the response is cached for
 * a year, so the prompt fix can only ever help new gardens. This one covers the rest.
 *
 * Deliberately conservative: it only strips an exact case-insensitive match on the species name
 * followed by a comma or a space. A meaning that genuinely opens with the word (say a flower
 * actually called "Forget-me-not" in a sentence about forgetting) keeps whatever follows, and the
 * worst case is that nothing is stripped, which is exactly today's behaviour.
 */
function withoutLeadingName(name: string, meaning: string): string {
  const n = name.trim()
  if (!n || !meaning.toLowerCase().startsWith(n.toLowerCase())) return meaning
  const rest = meaning.slice(n.length).replace(/^\s*,\s*|^\s+/, '')
  if (!rest) return meaning
  return rest.charAt(0).toUpperCase() + rest.slice(1)
}
