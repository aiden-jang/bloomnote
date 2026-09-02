import FlowerSVG from './FlowerSVG'
import type { GardenData } from '../garden'
import { formatGardenDate } from '../lib/formatDate'
import styles from './RemixContext.module.css'

interface Props {
  previous: GardenData
  label: string
}

export default function RemixContext({ previous, label }: Props) {
  const grownOn = formatGardenDate(previous.createdAt)
  return (
    <aside className={styles.panel} aria-label={label}>
      <p className={styles.label}>
        {label}
        {grownOn && <span className={styles.labelDate}> · {grownOn}</span>}
      </p>
      <div className={styles.miniGarden}>
        {previous.flowers.map((flower, i) => (
          <span key={`${i}-${flower.name}`} className={styles.miniSlot}>
            <FlowerSVG flower={flower} index={i} bloomed swayDelay={i} />
          </span>
        ))}
      </div>
      {previous.message && <p className={styles.message}>"{previous.message}"</p>}
      {previous.bouquetNote && <p className={styles.bouquet}>{previous.bouquetNote}</p>}
    </aside>
  )
}
