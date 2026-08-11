import { useState, useEffect, useRef, type CSSProperties } from 'react'
import FlowerSVG from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { prefersReducedMotion } from '../lib/motion'
import { playBloom, pulse } from '../sound'
import { withoutLeadingFlowerName } from '../lib/flowerMeaning'
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
  /** How much of a draft exists, letting the empty plot quietly grow with the note. */
  draftGrowth?: 0 | 1 | 2 | 3
  /** Index of the flower being looked at, from the legend or from the plot itself. */
  focused?: number | null
  /** Pointing at a flower, or letting go of it. */
  onFocus?: (index: number | null) => void
  /**
   * Bumped once each time the garden is watered. A counter rather than a boolean so a second
   * watering restarts the animation: toggling a flag back and forth needs the caller to time the
   * reset, and a changed `key` on the drop layer is what actually replays the CSS.
   */
  wateredAt?: number
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
 * A bee, doing its rounds.
 *
 * The recipient view is the whole point of the app and, once the bloom animation finishes, it stops
 * moving: a still picture of some flowers. One small thing with somewhere to be turns it into a
 * place. It visits the flowers rather than wandering, because a bee that ignored the flowers would
 * read as a bug crawling on the screen.
 *
 * Deliberately not a swarm. One bee is a garden; three is an infestation.
 */
function Bee() {
  return (
    <svg viewBox="0 0 16 11" className={styles.beeBody} aria-hidden>
      {/* Wings first, so the body sits over them. */}
      <ellipse cx="7" cy="3.4" rx="3.1" ry="2.1" fill="#eaf4ff" opacity="0.75" />
      <ellipse cx="10" cy="3.6" rx="2.6" ry="1.8" fill="#eaf4ff" opacity="0.6" />
      <ellipse cx="8.6" cy="6.4" rx="4.4" ry="3" fill="#f0b429" />
      <path d="M7.2 3.9 A4.4 3 0 0 0 7.2 8.9 Z" fill="#4a3b1a" opacity="0.85" />
      <path d="M10.1 4.3 A4.4 3 0 0 0 10.1 8.5 Z" fill="#4a3b1a" opacity="0.85" />
      <circle cx="4.6" cy="6.4" r="1.5" fill="#4a3b1a" />
      <path d="M3.6 4.9 L2.2 3.4 M4.4 4.6 L3.6 2.9" stroke="#4a3b1a" strokeWidth="0.5" strokeLinecap="round" />
    </svg>
  )
}

/*
 * Grass and pebbles along the soil line.
 *
 * The flowers are illustrated and the ground was two flat divs with a ruler-straight edge between
 * them, so the two halves of the scene read as different pieces of software. This breaks the line
 * up without moving it: the stems land exactly on the soil surface, so an undulating crest would
 * leave a stem ending a few pixels above the dirt.
 *
 * Positions are hand-picked, like PETAL_DRIFTERS, and deliberately avoid where stems land. Flowers
 * sit at 10/30/36.7/50/63.3/70/90% depending on how many there are; every value here clears all of
 * those by at least six points, so a tuft never sprouts out of a stem.
 */
const SOIL_DETAIL = [
  { x: 4, tuft: true },
  { x: 21, tuft: false },
  { x: 44, tuft: true },
  { x: 58, tuft: false },
  { x: 82, tuft: true },
  { x: 96, tuft: false },
] as const

/**
 * The soil crest.
 *
 * Mounds *upward only*, never below the flat line. The stems are anchored to the soil surface, so a
 * crest that dipped would leave one ending in mid-air; rising instead buries the bottom pixel or two
 * of whichever stems it passes, which is what soil heaped around a stem actually looks like. The
 * ground paints after the flowers, so that overlap happens for free.
 */
function SoilCrest() {
  return (
    <svg className={styles.crest} viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 6 L0 4 Q6 1.5 13 3.5 Q20 5.5 27 3 Q34 1 41 3.5 Q48 5.5 55 3 Q62 1.5 69 3.5 Q76 5.5 83 3 Q90 1 97 3.5 L100 3 L100 6 Z"
        fill="#a0714f"
      />
    </svg>
  )
}

function SoilLine() {
  return (
    <div className={styles.soilLine} aria-hidden>
      <SoilCrest />
      {SOIL_DETAIL.map(({ x, tuft }) =>
        tuft ? (
          <svg key={x} className={styles.tuft} style={{ left: `${x}%` }} viewBox="0 0 12 9">
            <path d="M6 9 C5.4 6 4.6 4 3 2.2" className={styles.blade} />
            <path d="M6 9 C6 6.2 6 4.2 6.2 1.6" className={styles.blade} />
            <path d="M6 9 C6.7 6.3 7.6 4.4 9.2 2.8" className={styles.blade} />
          </svg>
        ) : (
          <span key={x} className={styles.pebble} style={{ left: `${x}%` }} />
        ),
      )}
    </div>
  )
}

/**
 * Empty-plot teaser. A single ground-anchored sprout that grows up,
 * unfurls a leaf, then retracts on a slow loop. Hints at the bloom
 * to come without committing to any specific flower aesthetic.
 *
 * Pure CSS — no React state, no setInterval, no rerenders. The
 * animation runs entirely off the GPU once the layer is composited.
 */
function GhostSprout({ growth }: { growth: 0 | 1 | 2 | 3 }) {
  return (
    <div className={`${styles.ghostSprout} ${styles[`ghostSproutGrowing${growth}`] ?? ''}`} aria-hidden>
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
        <path
          d="M 10 38 Q 2 31, 5 40 Q 8 40, 10 38"
          fill="currentColor"
          className={styles.ghostLeafSecond}
        />
        <path
          d="M 10 20 Q 3 14, 6 23 Q 9 23, 10 20"
          fill="currentColor"
          className={styles.ghostLeafThird}
        />
        <circle cx="10" cy="17" r="2.2" className={styles.ghostBud} />
      </svg>
    </div>
  )
}

export default function GardenScene({ flowers, autoBloom, onAllBloomed, occasion, silent = false, compact = false, draftGrowth = 0, focused = null, onFocus, wateredAt = 0 }: Props) {
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

  /*
   * Which flower the bee is heading for.
   *
   * A destination index plus a CSS transition, rather than a keyframe path: the number of flowers
   * varies from three to five, so any hand-authored @keyframes would be wrong for most gardens.
   * This way the route is always exactly the flowers that are actually there.
   *
   * Only after everything has bloomed. A bee arriving mid-bloom would be competing with the one
   * thing the recipient is meant to be watching.
   */
  const [beeAt, setBeeAt] = useState(0)
  const beeFlying = autoBloom && placed.length > 0 && bloomedCount >= placed.length && !prefersReducedMotion()
  useEffect(() => {
    if (!beeFlying) return
    // Uneven dwell: a fixed interval reads as a machine on a track. Prime-ish numbers so the bee
    // never falls into step with the flowers' sway.
    const t = setInterval(() => setBeeAt(i => (i + 1) % placed.length), 3700)
    return () => clearInterval(t)
  }, [beeFlying, placed.length])

  /*
   * The watering: drops fall, then every flower perks up.
   *
   * Held as on/off state rather than derived straight from `wateredAt` because a CSS animation only
   * replays when the class goes away and comes back. Turning it off after a second does that, and
   * also means the drop layer isn't sitting in the tree for the rest of the visit.
   */
  const [perking, setPerking] = useState(false)
  useEffect(() => {
    if (!wateredAt || prefersReducedMotion()) return
    setPerking(true)
    const t = setTimeout(() => setPerking(false), 1000)
    return () => clearTimeout(t)
  }, [wateredAt])

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
      {focused !== null && flowers[focused] && (
        <aside className={styles.flowerPeek} aria-live="polite">
          <span className={styles.flowerPeekSwatches} aria-hidden>
            {flowers[focused].petalColors.slice(0, 4).map((color, index) => (
              <span key={`${color}-${index}`} style={{ background: color }} />
            ))}
          </span>
          <span className={styles.flowerPeekCopy}>
            <strong>{flowers[focused].name}</strong>
            <span>{withoutLeadingFlowerName(flowers[focused].name, flowers[focused].meaning)}</span>
          </span>
          <button type="button" onClick={() => onFocus?.(null)} aria-label="Close flower meaning">
            ×
          </button>
        </aside>
      )}
      <div className={styles.garden}>
        {showGhostSprout && <GhostSprout growth={draftGrowth} />}
        {beeFlying && (() => {
          const target = placed[beeAt % placed.length]!
          /*
           * Height comes from the flower, not a constant.
           *
           * `bottom: 62%` looked right on whichever garden I happened to be testing and was wrong
           * everywhere else: stems run from 70 to 115, so a fixed height leaves the bee hovering
           * below the tall flowers and above the short ones. FlowerSVG draws a head 30px down from
           * the top of a (stemHeight + 80) box anchored at the soil, so the head sits
           * `stemHeight + 50` above the bottom. Minus half the bee to centre it on the head.
           */
          const headUp = target.spec.stemHeight + 50 - 8
          return (
            <div
              className={styles.bee}
              style={{ left: `${target.left}%`, bottom: `${headUp}px` }}
              aria-hidden
            >
              <Bee />
            </div>
          )
        })()}
        {/* One drop per flower, aimed at that flower's own column, so it reads as watering these
            flowers rather than as weather. Keyed on the count so a second watering replays it. */}
        {perking && (
          <div className={styles.dropLayer} key={wateredAt} aria-hidden>
            {placed.map((p, i) => (
              <span
                key={i}
                className={styles.drop}
                style={{ left: `${p.left}%`, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </div>
        )}
        {placed.map((p, i) => (
          <div
            key={placementKey(p.spec, i)}
            className={
              (focused === i
                ? `${styles.flowerSlot} ${styles.flowerSlotOn}`
                : focused !== null
                  ? `${styles.flowerSlot} ${styles.flowerSlotOff}`
                  : styles.flowerSlot) + (perking ? ` ${styles.flowerSlotPerk}` : '')
            }
            // Focused flowers come forward, so a lifted flower is never behind its neighbour.
            // The perk waits out its own drop's fall, so each flower answers the water that hit it.
            style={{
              left: `${p.left}%`,
              zIndex: focused === i ? 4 : p.zIndex,
              animationDelay: `${i * 90 + 460}ms`,
            }}
            title={p.spec.name}
            onMouseEnter={() => onFocus?.(i)}
            onMouseLeave={() => onFocus?.(null)}
            // Touch has no hover, and this is mostly opened on a phone: a tap picks a flower and
            // tapping it again lets go, so the link is reachable without a mouse.
            onClick={() => onFocus?.(focused === i ? null : i)}
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
        <SoilLine />
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
