import type { GardenForecast } from '../lib/gardenForecast'
import styles from './Composer.module.css'

export default function GardenForecastPanel({ forecast }: { forecast: GardenForecast }) {
  return (
    <section className={styles.forecast} aria-label="Garden forecast" aria-live="polite">
      <div className={styles.forecastHead}>
        <span>
          <span className={styles.forecastEyebrow}>garden forecast</span>
          <strong>{forecast.tone}</strong>
        </span>
        <span className={styles.forecastSwatches} aria-label={forecast.palette}>
          {forecast.colors.map((color) => (
            <i key={color} style={{ backgroundColor: color }} />
          ))}
        </span>
      </div>
      <p>
        likely {forecast.shape} in {forecast.palette}, under {forecast.light}.
      </p>
      <div className={styles.forecastSoil}>
        <span className={styles.forecastDots} aria-hidden>
          {[1, 2, 3].map((level) => (
            <i key={level} data-grown={level <= forecast.detailLevel} />
          ))}
        </span>
        <span>{forecast.detailCopy}</span>
      </div>
      <small>direction only. the final garden still gets to surprise you.</small>
    </section>
  )
}
