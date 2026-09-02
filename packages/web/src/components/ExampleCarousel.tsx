import FlowerSVG from './FlowerSVG'
import { EXAMPLE_GARDENS, type ExampleGarden } from '../data/exampleGardens'
import styles from './ExampleCarousel.module.css'

interface Props {
  onSelect: (g: ExampleGarden) => void
  collapsed?: boolean
  activeId?: string | undefined
  onPreview?: (id: string | null) => void
}

export default function ExampleCarousel({ onSelect, collapsed = false, activeId, onPreview }: Props) {
  return (
    <div className={`${styles.collapser} ${collapsed ? styles.collapsed : ''}`}>
      {/* Inner element owns the overflow clip. The collapser animates grid-template-rows 1fr to 0fr
          around it, which needs a child that can be clipped. */}
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
  const snippet = truncate(garden.message, 120)

  return (
    <li className={styles.cardItem}>
      <button
        type="button"
        className={active ? `${styles.card} ${styles.cardActive}` : styles.card}
        onClick={() => onSelect(garden)}
        // Hover and focus both preview, so the link between card and hero exists for the keyboard too.
        // Pointing at a card only changes what is on display; the click is the only thing that commits.
        onMouseEnter={() => onPreview?.(garden.id)}
        onMouseLeave={() => onPreview?.(null)}
        onFocus={() => onPreview?.(garden.id)}
        onBlur={() => onPreview?.(null)}
        aria-label={`try the ${garden.mood} example: from ${garden.from} to ${garden.to}`}
      >
        <div className={styles.miniGarden} aria-hidden>
          {garden.flowers.slice(0, 3).map((f, i) => (
            <div
              key={i}
              className={styles.miniSlot}
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
  // Don't truncate mid-word: cut at the last space before `max`.
  const slice = s.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  return slice.slice(0, lastSpace > max - 20 ? lastSpace : max).trimEnd() + '…'
}
