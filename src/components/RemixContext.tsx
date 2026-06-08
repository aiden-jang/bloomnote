import FlowerSVG from './FlowerSVG'
import type { GardenData } from '../garden'
import styles from './RemixContext.module.css'

interface Props {
  /** The previous garden this view is "replying to." */
  previous: GardenData
  /** Optional headline like "Replying to Sarah" or "You wrote this:". */
  label: string
}

/**
 * The thread context panel — a compact view of a previous garden, shown
 * either above the composer (when the user is writing a reply) or
 * inline with a recipient's garden (when they're looking at a reply
 * and want to see what they originally sent).
 *
 * Renders the previous flowers small, the original message in italic,
 * and the AI's bouquet note from that round. No interactivity — this
 * is purely "here's the thread."
 */
export default function RemixContext({ previous, label }: Props) {
  return (
    <aside className={styles.panel} aria-label={label}>
      <p className={styles.label}>{label}</p>
      <div className={styles.miniGarden}>
        {previous.flowers.map((flower, i) => (
          <span key={`${i}-${flower.name}`} className={styles.miniSlot}>
            <FlowerSVG flower={flower} index={i} bloomed swayDelay={i} />
          </span>
        ))}
      </div>
      {previous.message && (
        <p className={styles.message}>"{previous.message}"</p>
      )}
      {previous.bouquetNote && (
        <p className={styles.bouquet}>{previous.bouquetNote}</p>
      )}
    </aside>
  )
}
