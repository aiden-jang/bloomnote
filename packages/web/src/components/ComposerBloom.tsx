import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import type { FlowerSpec } from '../garden'
import styles from './Composer.module.css'

export function Spinner() {
  return (
    <span className={styles.spinner} aria-hidden>
      <svg width="20" height="26" viewBox="0 0 20 26" fill="none">
        <line
          x1="10"
          y1="26"
          x2="10"
          y2="10"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={styles.sproutStem}
        />
        <path d="M 10 14 Q 17 9, 14 16 Q 11 15, 10 14" fill="currentColor" className={styles.sproutLeaf} />
      </svg>
    </span>
  )
}

/* Don't merge this with the plot's ambient drift. That one loops forever and belongs to the
   scene; this one falls once, when a garden is finished. */
const FALL_MS = 4200

export function PetalFall({ flowers }: { flowers: FlowerSpec[] }) {
  const [done, setDone] = useState(prefersReducedMotion())

  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setTimeout(() => setDone(true), FALL_MS)
    return () => clearTimeout(t)
  }, [])

  // Unmounted, not left at opacity 0: eighteen absolutely-positioned nodes should not outlive
  // the four seconds they are visible for.
  if (done || flowers.length === 0) return null

  return (
    <div className={styles.petalFall} aria-hidden>
      {PETAL_FALL.map(([left, size, delay, duration, drift, rotate], i) => {
        const flower = flowers[i % flowers.length]!
        return (
          <span
            key={i}
            className={styles.fallPetal}
            style={{
              ['--left' as string]: `${left}%`,
              ['--size' as string]: `${size}px`,
              ['--delay' as string]: `${delay}ms`,
              ['--duration' as string]: `${duration}ms`,
              ['--drift' as string]: `${drift}px`,
              ['--rotate' as string]: `${rotate}deg`,
              ['--color' as string]: flower.petalColors[i % flower.petalColors.length]!,
            }}
          />
        )
      })}
    </div>
  )
}

/* left %, size px, delay ms, duration ms, drift px, start rotation deg.
   Hand-placed rather than random so the spread stays uneven without clumping. */
// prettier-ignore
const PETAL_FALL: Array<[number, number, number, number, number, number]> = [
  [6, 10, 0, 3000, 42, 12], [18, 7, 320, 3400, -28, 200], [29, 11, 120, 2700, 60, 74],
  [41, 8, 560, 3200, -46, 310], [52, 9, 240, 3050, 34, 140], [63, 6, 700, 3500, -22, 20],
  [74, 10, 90, 2850, 52, 250], [86, 8, 430, 3300, -38, 96], [94, 7, 620, 3100, 26, 175],
  [12, 8, 880, 2900, -34, 58], [35, 6, 1010, 3250, 44, 290], [58, 10, 760, 2950, -50, 130],
  [80, 7, 1120, 3150, 30, 218], [24, 9, 1240, 3050, -40, 66],
]
