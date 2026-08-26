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
  /**
   * The example currently growing in the hero plot above. Marked on its card so the big garden
   * and the small card read as the same thing — without it a visitor watches a garden bloom,
   * looks down at three cards, and has no way to know the one on top is one of these.
   */
  activeId?: string | undefined
  /**
   * Show this example in the hero. Fired on hover and on focus, so pointing at a card previews
   * it full size. Composer pauses its cycle while a card is being pointed at; passing null
   * hands control back.
   */
  onPreview?: (id: string | null) => void
}

/**
 * Three curated examples, above the composer, on a fresh route with an empty form.
 *
 * A first-time visitor can't write the note because they haven't seen what the note produces. These
 * show the output before asking for the input; "try this" fills every field, so they can reach the
 * bloom without typing anything.
 */
export default function ExampleCarousel({ onSelect, collapsed = false, activeId, onPreview }: Props) {
  return (
    <div className={`${styles.collapser} ${collapsed ? styles.collapsed : ''}`}>
      {/* Inner element owns the overflow clip; the collapser animates
          grid-template-rows 1fr↔0fr around it. */}
      <div className={styles.collapserInner}>
        <section className={styles.wrap} aria-label="example gardens" aria-hidden={collapsed}>
          <p className={styles.heading}>or steal one of these</p>
          <ul className={styles.list}>
            {EXAMPLE_GARDENS.map((g) => (
              <ExampleCard
                key={g.id}
                garden={g}
                onSelect={onSelect}
                active={g.id === activeId}
                {...(onPreview ? { onPreview } : {})}
              />
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
  active = false,
  onPreview,
}: {
  garden: ExampleGarden
  onSelect: (g: ExampleGarden) => void
  active?: boolean
  onPreview?: (id: string | null) => void
}) {
  // Truncate the message to two short lines worth of preview text —
  // keeps card heights consistent regardless of the underlying note
  // length. Cards lined up at uniform heights read as "designed."
  const snippet = truncate(garden.message, 120)

  return (
    <li className={styles.cardItem}>
      <button
        type="button"
        className={active ? `${styles.card} ${styles.cardActive}` : styles.card}
        onClick={() => onSelect(garden)}
        // Hover and focus both preview, so the link between card and hero exists for the keyboard
        // too. Nothing here changes the form — pointing at a card only changes what's on display,
        // and the click is still the only thing that commits.
        onMouseEnter={() => onPreview?.(garden.id)}
        onMouseLeave={() => onPreview?.(null)}
        onFocus={() => onPreview?.(garden.id)}
        onBlur={() => onPreview?.(null)}
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
              <div className={styles.miniFlower}>
                <FlowerSVG flower={f} index={i} bloomed swayDelay={i} />
              </div>
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
