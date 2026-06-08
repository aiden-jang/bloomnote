import { useState, useEffect } from 'react'
import FlowerSVG from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { playBloom } from '../sound'
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
    </div>
  )
}
