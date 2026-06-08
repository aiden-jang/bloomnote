import { useState, useEffect } from 'react'
import FlowerSVG from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { playBloom, pulse } from '../sound'
import styles from './GardenScene.module.css'

interface Placement {
  spec: FlowerSpec
  left: number
  zIndex: number
}

interface Props {
  flowers: FlowerSpec[]
  autoBloom: boolean
  onAllBloomed?: () => void
}

function placeFlowers(flowers: FlowerSpec[]): Placement[] {
  const count = flowers.length
  if (count === 0) return []

  const spread = 80
  const center = 50
  const step = count > 1 ? spread / (count - 1) : 0
  const start = center - spread / 2

  return flowers.map((spec, i) => ({
    spec,
    left: count === 1 ? center : start + i * step,
    zIndex: i % 2 === 0 ? 2 : 1,
  }))
}

// Stable identity for a placed flower so React can keep DOM nodes when
// the array reference changes but the underlying flowers are the same.
function placementKey(spec: FlowerSpec, index: number): string {
  return `${index}-${spec.name}-${spec.petalColors[0]}`
}

// Petal drift configs are hand-tuned — no Math.random, so re-renders
// don't jitter the positions. Each entry describes one petal's path
// across the scene: start position (% across the top), horizontal
// drift distance (positive = right, negative = left), bloom-relative
// start delay, total animation duration, visual size, and initial
// rotation. Colors get filled in at render time from the actual
// flowers, so the drift visually belongs to this specific garden.
const PETAL_DRIFTERS = [
  { startX: 15, driftX:  40, delay:  300, duration: 3800, size:  9, rotate:  25 },
  { startX: 30, driftX: -35, delay:  650, duration: 4200, size: 11, rotate: -40 },
  { startX: 50, driftX:  30, delay: 1000, duration: 3500, size:  8, rotate:  60 },
  { startX: 70, driftX: -45, delay: 1400, duration: 4500, size: 12, rotate: -20 },
  { startX: 82, driftX:  25, delay: 1800, duration: 3700, size: 10, rotate:  45 },
  { startX: 55, driftX: -30, delay: 2200, duration: 4000, size:  9, rotate: -65 },
] as const

export default function GardenScene({ flowers, autoBloom, onAllBloomed }: Props) {
  const [bloomedCount, setBloomedCount] = useState(0)
  const placed = placeFlowers(flowers)

  // The dedupe-by-signature ref I had here was actively hostile under
  // React 18 strict mode: first effect runs → sets the ref. Cleanup
  // clears the scheduled timers. Re-run effect → ref still matches →
  // early-return → no bloom. The cleanup function already makes this
  // effect idempotent (timers from a prior run are torn down before a
  // new run schedules its own), so re-keying GardenScene from the
  // parent is the right way to reset the bloom, not a ref-based guard.
  const flowerSig = flowers.map(f => f.name).join('|')

  useEffect(() => {
    if (!autoBloom) return

    setBloomedCount(0)
    const timers: ReturnType<typeof setTimeout>[] = []

    placed.forEach((_, i) => {
      const t = setTimeout(() => {
        playBloom(i)
        pulse()
        setBloomedCount(prev => {
          const next = prev + 1
          if (next === placed.length && onAllBloomed) {
            setTimeout(onAllBloomed, 400)
          }
          return next
        })
      }, i * 380)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
  }, [autoBloom, flowerSig, placed.length, onAllBloomed])

  // Drift petals. Only rendered when there are flowers and the scene
  // is allowed to bloom — re-keyed by flowerSig so the animations
  // restart from 0 on every new garden.
  const drifters = autoBloom && flowers.length > 0
    ? PETAL_DRIFTERS.map((cfg, i) => {
        const flower = flowers[i % flowers.length]
        return {
          ...cfg,
          color: flower.petalColors[i % flower.petalColors.length],
          key: `${flowerSig}-drift-${i}`,
        }
      })
    : []

  return (
    <div className={styles.scene}>
      <div className={styles.sky} />
      <div className={styles.garden}>
        {placed.map((p, i) => (
          <div
            key={placementKey(p.spec, i)}
            className={styles.flowerSlot}
            style={{ left: `${p.left}%`, zIndex: p.zIndex }}
            title={p.spec.name}
          >
            <FlowerSVG
              flower={p.spec}
              index={i}
              bloomed={i < bloomedCount}
              swayDelay={i}
            />
          </div>
        ))}
      </div>
      <div className={styles.ground}>
        <div className={styles.groundTop} />
        <div className={styles.groundBase} />
      </div>
      {/* Drift layer sits on top of the ground but its petals are
          small enough not to obscure the flowers. Pointer-events:none
          via the class so it doesn't catch clicks. */}
      {drifters.length > 0 && (
        <div className={styles.petalLayer} aria-hidden>
          {drifters.map(p => (
            <span
              key={p.key}
              className={styles.driftPetal}
              style={{
                ['--start-x' as string]: `${p.startX}%`,
                ['--drift-x' as string]: `${p.driftX}%`,
                ['--size' as string]: `${p.size}px`,
                ['--color' as string]: p.color,
                ['--delay' as string]: `${p.delay}ms`,
                ['--duration' as string]: `${p.duration}ms`,
                ['--rotate' as string]: `${p.rotate}deg`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
