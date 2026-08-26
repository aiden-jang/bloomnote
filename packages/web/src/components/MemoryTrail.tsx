import FlowerSVG from './FlowerSVG'
import type { GardenData } from '../garden'
import { formatGardenDate } from '../lib/formatDate'
import styles from './MemoryTrail.module.css'

interface Props {
  previous: GardenData
  current: GardenData
}

function names(garden: GardenData): string {
  if (garden.from && garden.to) return `${garden.from} to ${garden.to}`
  if (garden.from) return `from ${garden.from}`
  if (garden.to) return `for ${garden.to}`
  return 'a little garden'
}

function TrailGarden({
  garden,
  label,
  latest = false,
}: {
  garden: GardenData
  label: string
  latest?: boolean
}) {
  const date = formatGardenDate(garden.createdAt)
  return (
    <li className={styles.stop}>
      <span className={latest ? `${styles.dot} ${styles.dotLatest}` : styles.dot} aria-hidden>
        {latest ? '✦' : ''}
      </span>
      <div className={styles.card}>
        <div className={styles.cardTop}>
          <span>
            <span className={styles.eyebrow}>{label}</span>
            <strong className={styles.names}>{names(garden)}</strong>
          </span>
          {date && <time className={styles.date}>{date}</time>}
        </div>
        <div className={styles.flowers} aria-hidden>
          {garden.flowers.slice(0, 7).map((flower, index) => (
            <span className={styles.flower} key={`${flower.name}-${index}`}>
              <FlowerSVG flower={flower} index={index} bloomed swayDelay={index} />
            </span>
          ))}
        </div>
        {garden.message ? (
          <p className={styles.note}>{garden.message}</p>
        ) : (
          <p className={`${styles.note} ${styles.quiet}`}>a garden, just because.</p>
        )}
      </div>
    </li>
  )
}

/** A compact, chronological keepsake for the two notes in a reply exchange. */
export default function MemoryTrail({ previous, current }: Props) {
  return (
    <details className={styles.trail}>
      <summary className={styles.summary}>
        <span className={styles.summaryMark} aria-hidden>
          ❀
        </span>
        <span>
          <strong>follow the garden trail</strong>
          <small>two gardens, one little story</small>
        </span>
        <span className={styles.chevron} aria-hidden>
          ⌄
        </span>
      </summary>
      <div className={styles.body}>
        <p className={styles.intro}>where this garden grew from</p>
        <ol className={styles.timeline}>
          <TrailGarden garden={previous} label="the first garden" />
          <TrailGarden garden={current} label="grown back" latest />
        </ol>
      </div>
    </details>
  )
}
