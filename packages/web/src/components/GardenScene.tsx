import { useState, useEffect, useRef, type CSSProperties } from 'react'
import FlowerSVG from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { prefersReducedMotion } from '../lib/motion'
import { playBloom, pulse } from '../sound'
import styles from './GardenScene.module.css'

/**
 * Sky gradient palette by occasion. Each entry is two soft pastel
 * stops (top → bottom) that subtly shift the scene's atmosphere
 * without overpowering the flowers themselves. The default ("just-
 * because") and the fallback for unknown values is the original
 * blue → yellow-green gradient.
 *
 * Constraint: stops must stay light enough that black-on-light text
 * (the recipient view's message, the legend) remains readable
 * against any flower colors that bleed into the same space.
 * Saturation was deliberately dialed down — premium products use
 * mood-shift, not paint chips.
 */
const SKY_GRADIENTS: Record<string, { top: string; bottom: string }> = {
  // Default — clear morning sky into pale meadow grass.
  'just-because': { top: '#d4eeff', bottom: '#e8f5d0' },
  // Warm peach into cream — celebratory without screaming.
  birthday:       { top: '#fde6cf', bottom: '#fff1d8' },
  // Soft sage greens — grounded, grateful.
  'thank-you':    { top: '#e2efd9', bottom: '#f0f5e3' },
  // Pink dusk into champagne — romantic.
  anniversary:    { top: '#f6e0e8', bottom: '#f9efe0' },
  // Golden warm — achievement, energy.
  congrats:       { top: '#fde2c0', bottom: '#ffeac8' },
  // Pale healing greens — gentle, restorative.
  'get-well':     { top: '#d4ecdd', bottom: '#e8f4d8' },
  // Cool muted overcast — quiet space for grief.
  sympathy:       { top: '#d8dde6', bottom: '#e5e9ef' },
}

function gradientFor(occasion?: string): { top: string; bottom: string } {
  if (occasion && occasion in SKY_GRADIENTS) return SKY_GRADIENTS[occasion]!
  return SKY_GRADIENTS['just-because']!
}

/** Time between consecutive flower blooms. Exported so the legend
 *  can stagger its row reveals in sync with the bloom they describe. */
export const BLOOM_STAGGER_MS = 500

/** How long to hold the fully-bloomed scene before the post-bloom
 *  fade-ins (message, legend, CTA) start. Lets the bloom breathe. */
const BLOOM_HOLD_MS = 1000

interface Placement {
  spec: FlowerSpec
  left: number
  zIndex: number
}

interface Props {
  flowers: FlowerSpec[]
  autoBloom: boolean
  onAllBloomed?: () => void
  /**
   * Drives the sky gradient. Defaults to "just-because" when omitted
   * or unknown — pre-existing gardens without an `occasion` field
   * fall through to that default.
   */
  occasion?: string | undefined
  /**
   * Bloom without the chime. Sound is on by default, and the homepage demo re-blooms on a loop —
   * without this it would ding at the visitor every few seconds for as long as they sat on the
   * page. The bloom sound should mark *their* garden arriving, which is the whole reason it's
   * worth having; spending it on a background loop makes it mean nothing.
   */
  silent?: boolean
  /** Shrink to a waiting bed. Only meaningful with no flowers — see `.sceneCompact`. */
  compact?: boolean
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

/**
 * Empty-plot teaser. A single ground-anchored sprout that grows up,
 * unfurls a leaf, then retracts on a slow loop. Hints at the bloom
 * to come without committing to any specific flower aesthetic.
 *
 * Pure CSS — no React state, no setInterval, no rerenders. The
 * animation runs entirely off the GPU once the layer is composited.
 */
function GhostSprout() {
  return (
    <div className={styles.ghostSprout} aria-hidden>
      <svg viewBox="0 0 20 60" className={styles.ghostSproutSvg}>
        <line
          x1="10" y1="60" x2="10" y2="20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={styles.ghostStem}
        />
        <path
          d="M 10 28 Q 18 22, 15 30 Q 12 29, 10 28"
          fill="currentColor"
          className={styles.ghostLeaf}
        />
      </svg>
    </div>
  )
}

export default function GardenScene({ flowers, autoBloom, onAllBloomed, occasion, silent = false, compact = false }: Props) {
  // Resolve the gradient once per render; the cost is a Record lookup,
  // not enough to justify memoization. Inline `--sky-top` / `--sky-bottom`
  // get consumed by the CSS module on the .sky element.
  const sky = gradientFor(occasion)
  const sceneStyle: CSSProperties = {
    ['--sky-top' as string]: sky.top,
    ['--sky-bottom' as string]: sky.bottom,
  }
  const [bloomedCount, setBloomedCount] = useState(0)
  const placed = placeFlowers(flowers)

  // Re-keying GardenScene from the parent (key prop) is the right way
  // to reset the bloom — the cleanup function makes this effect
  // idempotent (timers from a prior run are torn down before a new
  // run schedules its own).
  const flowerSig = flowers.map(f => f.name).join('|')

  useEffect(() => {
    if (!autoBloom) return

    setBloomedCount(0)
    const timers: ReturnType<typeof setTimeout>[] = []

    placed.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!silent) {
          playBloom(i)
          pulse()
        }
        setBloomedCount(prev => {
          const next = prev + 1
          // Hold the moment after the last flower blooms before the
          // legend + message start fading in. The bloom is the
          // emotional peak — letting it breathe makes it land.
          if (next === placed.length && onAllBloomed) {
            setTimeout(onAllBloomed, BLOOM_HOLD_MS)
          }
          return next
        })
      }, i * BLOOM_STAGGER_MS)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
  }, [autoBloom, flowerSig, placed.length, onAllBloomed, silent])

  // Drift petals. Only rendered when there are flowers and the scene
  // is allowed to bloom — re-keyed by flowerSig so the animations
  // restart from 0 on every new garden.
  const drifters = autoBloom && flowers.length > 0
    ? PETAL_DRIFTERS.map((cfg, i) => {
        const flower = flowers[i % flowers.length]!
        return {
          ...cfg,
          color: flower.petalColors[i % flower.petalColors.length]!,
          key: `${flowerSig}-drift-${i}`,
        }
      })
    : []

  // Empty-state teaser: a single sprout that grows and retracts on a
  // gentle loop. Sits in the same plot the eventual flowers will fill,
  // so the visual story is "this place is waiting for something"
  // instead of "loading" → "boom flowers." Hidden as soon as real
  // flowers arrive.
  const showGhostSprout = flowers.length === 0

  // Scroll parallax. Petals lag behind content scroll — as the user
  // moves down the recipient view to read the note, the petal layer
  // drifts upward at ~25% of scroll speed. Implementation:
  //
  //   1. Passive scroll listener (no event-handler perf hit).
  //   2. requestAnimationFrame coalesces repeated scroll events into
  //      one DOM mutation per frame (max 60Hz).
  //   3. Updates a single CSS custom property; the .petalLayer
  //      consumes it via transform. One write per frame, no React
  //      re-renders, no Layout/Paint cost beyond the GPU composite.
  //
  // Honors prefers-reduced-motion by skipping the listener entirely;
  // the CSS variable stays at its 0 fallback so the petals don't move.
  const sceneRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return

    let raf = 0
    const apply = () => {
      raf = 0
      sceneRef.current?.style.setProperty('--scroll-y', `${window.scrollY}px`)
    }
    const onScroll = () => {
      // Coalesce: ignore further events until the next frame runs.
      if (raf) return
      raf = requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    apply() // sync initial position (handles refresh-mid-page case)

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      // Compact only ever applies to an empty plot; a scene with flowers in it always gets full
      // height, so a garden can never be cropped by a stale flag.
      className={compact && flowers.length === 0 ? `${styles.scene} ${styles.sceneCompact}` : styles.scene}
      ref={sceneRef}
      style={sceneStyle}
    >
      <div className={styles.sky} />
      <div className={styles.garden}>
        {showGhostSprout && <GhostSprout />}
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
