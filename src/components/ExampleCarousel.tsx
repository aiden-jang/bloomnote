import FlowerSVG from './FlowerSVG'
import { EXAMPLE_GARDENS, type ExampleGarden } from '../data/exampleGardens'
import styles from './ExampleCarousel.module.css'

interface Props {
  /**
   * Called when the user taps "try this" on an example. Composer wires
   * this to its setters so the form pre-fills with the example's
   * inputs — the user lands on the bloom screen for that example
   * within seconds of arriving on the site.
   */
  onSelect: (g: ExampleGarden) => void
  /**
   * When true, the carousel folds away (height collapses to 0 + fades)
   * instead of staying open. Composer sets this once the user starts a
   * draft. We collapse rather than unmount so the transition is smooth
   * — an abrupt unmount yanked the form upward with a visible jump.
   */
  collapsed?: boolean
}

/**
 * Homepage onboarding affordance. Three curated example gardens shown
 * stacked above the composer when:
 *
 *   - the user is on a fresh route (no remix seed), and
 *   - the form is still empty (no draft being typed).
 *
 * The goal is to show what Blossom *produces* before asking the user
 * to produce input. Most first-time visitors don't know what to write
 * because they can't see the output yet — examples close that loop.
 *
 * Tapping "try this" fires onSelect with the full example data; the
 * Composer pre-fills From, To, message, occasion, and mood, and the
 * user can either ship as-is to experience the bloom moment, or edit
 * any field. Either way they reach the "wow" moment without typing
 * a single character.
 */
export default function ExampleCarousel({ onSelect, collapsed = false }: Props) {
  return (
    <div className={`${styles.collapser} ${collapsed ? styles.collapsed : ''}`}>
      {/* Inner element owns the overflow clip; the collapser animates
          grid-template-rows 1fr↔0fr around it. */}
      <div className={styles.collapserInner}>
        <section className={styles.wrap} aria-label="example gardens" aria-hidden={collapsed}>
          <p className={styles.heading}>or try one of these</p>
          <ul className={styles.list}>
            {EXAMPLE_GARDENS.map(g => (
              <ExampleCard key={g.id} garden={g} onSelect={onSelect} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

function ExampleCard({
  garden,
  onSelect,
}: {
  garden: ExampleGarden
  onSelect: (g: ExampleGarden) => void
}) {
  // Truncate the message to two short lines worth of preview text —
  // keeps card heights consistent regardless of the underlying note
  // length. Cards lined up at uniform heights read as "designed."
  const snippet = truncate(garden.message, 120)

  return (
    <li className={styles.cardItem}>
      <button
        type="button"
        className={styles.card}
        onClick={() => onSelect(garden)}
        aria-label={`try the ${garden.mood} example: from ${garden.from} to ${garden.to}`}
      >
        {/* Mini garden preview. autoBloom is irrelevant here — these
            flowers render in their final bloomed state immediately via
            FlowerSVG's `bloomed` prop so the card feels calm, not
            animating-while-the-user-is-trying-to-read. Capped at 3
            flowers because at the narrow card width that's all that
            fits cleanly. */}
        <div className={styles.miniGarden} aria-hidden>
          {garden.flowers.slice(0, 3).map((f, i) => (
            <div
              key={i}
              className={styles.miniSlot}
              // Stagger the heights slightly so the row looks like a
              // garden, not a chart bar graph.
              style={{ ['--slot-rotate' as string]: `${(i - 1) * 2}deg` }}
            >
              <FlowerSVG flower={f} index={i} bloomed swayDelay={i} />
            </div>
          ))}
        </div>

        <div className={styles.body}>
          <p className={styles.fromLine}>
            <span className={styles.fromName}>{garden.from}</span>
            {' → '}
            <span className={styles.toName}>{garden.to}</span>
          </p>
          <p className={styles.snippet}>{snippet}</p>
        </div>
      </button>
    </li>
  )
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  // Don't truncate mid-word — cut at the last space before `max`.
  const slice = s.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  return slice.slice(0, lastSpace > max - 20 ? lastSpace : max).trimEnd() + '…'
}
