import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import FlowerSVG, { flowerBoxHeight, flowerHeadOffset } from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { prefersReducedMotion } from '../lib/motion'
import { ritualTime, type RitualTime } from '../lib/rituals'
import { playBloom, pulse } from '../sound'
import FlowerPeek from './FlowerPeek'
import styles from './GardenScene.module.css'
import { gradientFor, mixHex, placeFlowers, placementKey, type Placement } from '../lib/scene'

const GARDEN_MIN_HEIGHT = 200

const MOOD_AURAS = {
  tender: { className: styles.auraTender, marks: ['♡', '·', '♡', '·', '♡', '·'] },
  playful: { className: styles.auraPlayful, marks: ['✦', '●', '✦', '●', '✦', '●'] },
  wistful: { className: styles.auraWistful, marks: ['·', '◦', '·', '◦', '·', '◦'] },
  celebratory: { className: styles.auraCelebratory, marks: ['✦', '✧', '✦', '✧', '✦', '✧'] },
  steady: { className: styles.auraSteady, marks: ['•', '·', '•', '·', '•', '·'] },
} as const

function auraFor(mood?: string) {
  // Object.hasOwn, not `in`. See gradientFor in lib/scene.ts for what `in` does with '__proto__'.
  return mood && Object.hasOwn(MOOD_AURAS, mood) ? MOOD_AURAS[mood as keyof typeof MOOD_AURAS] : null
}

// prettier-ignore
const TIME_SKY: Record<RitualTime, { top: string; bottom: string; weight: number; sun: string; sunStrength: number }> = {
  morning:   { top: '#ffffff', bottom: '#ffffff', weight: 0,    sun: '255, 250, 235', sunStrength: 0.72 },
  afternoon: { top: '#fff6df', bottom: '#fffaf0', weight: 0.12, sun: '255, 248, 226', sunStrength: 0.78 },
  evening:   { top: '#f0a679', bottom: '#f8d9b4', weight: 0.42, sun: '255, 214, 170', sunStrength: 0.62 },
  night:     { top: '#1d2742', bottom: '#33395a', weight: 0.74, sun: '206, 219, 255', sunStrength: 0.20 },
}

/* Hand-placed, no Math.random, so a garden looks the same every time it opens. left %, top %, twinkle delay. */
// prettier-ignore
const STARS: Array<[number, number, number]> = [
  [8, 14, 0], [21, 31, 1.6], [34, 9, 0.8], [46, 24, 2.4],
  [58, 12, 1.1], [12, 44, 3.1], [67, 34, 0.4], [29, 52, 2.0],
  [52, 44, 1.4], [41, 38, 2.8],
]

export const BLOOM_STAGGER_MS = 500

const BLOOM_HOLD_MS = 1000

interface Props {
  flowers: FlowerSpec[]
  autoBloom: boolean
  onAllBloomed?: () => void
  occasion?: string | undefined
  onFocusRelease?: () => void
  mood?: string | undefined
  sprouting?: boolean
  sealed?: boolean
  silent?: boolean
  compact?: boolean
  draftGrowth?: 0 | 1 | 2 | 3
  focused?: number | null
  onFocus?: (index: number | null) => void
  wateredAt?: number
  journalGardenId?: string | undefined
  journalFrom?: string | undefined
  now?: Date
}

// Hand-tuned, no Math.random, so re-renders don't jitter the positions. Colours are filled in
// at render time from the actual flowers.
// prettier-ignore
const PETAL_DRIFTERS = [
  { startX: 15, driftX:  40, delay:  300, duration: 3800, size:  9, rotate:  25 },
  { startX: 30, driftX: -35, delay:  650, duration: 4200, size: 11, rotate: -40 },
  { startX: 50, driftX:  30, delay: 1000, duration: 3500, size:  8, rotate:  60 },
  { startX: 70, driftX: -45, delay: 1400, duration: 4500, size: 12, rotate: -20 },
  { startX: 82, driftX:  25, delay: 1800, duration: 3700, size: 10, rotate:  45 },
  { startX: 55, driftX: -30, delay: 2200, duration: 4000, size:  9, rotate: -65 },
] as const

function Bee() {
  return (
    <svg viewBox="0 0 16 11" className={styles.beeBody} aria-hidden>
      <ellipse cx="7" cy="3.4" rx="3.1" ry="2.1" fill="#eaf4ff" opacity="0.75" />
      <ellipse cx="10" cy="3.6" rx="2.6" ry="1.8" fill="#eaf4ff" opacity="0.6" />
      <ellipse cx="8.6" cy="6.4" rx="4.4" ry="3" fill="#f0b429" />
      <path d="M7.2 3.9 A4.4 3 0 0 0 7.2 8.9 Z" fill="#4a3b1a" opacity="0.85" />
      <path d="M10.1 4.3 A4.4 3 0 0 0 10.1 8.5 Z" fill="#4a3b1a" opacity="0.85" />
      <circle cx="4.6" cy="6.4" r="1.5" fill="#4a3b1a" />
      <path
        d="M3.6 4.9 L2.2 3.4 M4.4 4.6 L3.6 2.9"
        stroke="#4a3b1a"
        strokeWidth="0.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

const SOIL_DETAIL = [
  { x: 4, tuft: true },
  { x: 21, tuft: false },
  { x: 44, tuft: true },
  { x: 58, tuft: false },
  { x: 82, tuft: true },
  { x: 96, tuft: false },
] as const

/* Mounds upward only, never below the flat line. The stems are anchored to the soil surface,
   so a crest that dips leaves them hanging in the air. */
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

// prettier-ignore
const WAIT_SPROUTS: Array<[number, number, number]> = [
  [16, 0.78, 0], [31, 1, 0.55], [50, 0.88, 1.1], [68, 1.05, 0.3], [84, 0.74, 0.85],
]

// prettier-ignore
const MOTES: Array<[number, number, number]> = [
  [14, 22, 0], [31, 46, 2.7], [48, 16, 5.1], [63, 38, 1.4],
  [77, 27, 3.9], [88, 52, 6.3], [22, 63, 4.6],
]

function SeedBed({ placements }: { placements: Placement[] }) {
  return (
    <div className={styles.seedBed} aria-hidden>
      {placements.map((p, i) => (
        <span
          key={i}
          className={styles.seed}
          style={{
            left: `${p.left}%`,
            ['--depth' as string]: String(p.depth),
            animationDelay: `${i * 620}ms`,
          }}
        >
          <svg viewBox="0 0 16 22" className={styles.seedSvg}>
            <path
              d="M8 8.4 C 4.8 7.2 3.5 4.2 5.4 2.6 C 7.3 3.7 8 6.1 8 8.4 Z"
              fill={p.spec.stemColor}
              opacity="0.9"
            />
            <ellipse cx="8" cy="14.6" rx="5" ry="6.4" fill={p.spec.petalColors[0]} />
            <ellipse cx="6.3" cy="11.8" rx="1.5" ry="2.2" fill="#fff" opacity="0.38" />
          </svg>
        </span>
      ))}
    </div>
  )
}

function GhostSprout({ growth }: { growth: 0 | 1 | 2 | 3 }) {
  return (
    <div className={`${styles.ghostSprout} ${styles[`ghostSproutGrowing${growth}`] ?? ''}`} aria-hidden>
      <svg viewBox="0 0 20 60" className={styles.ghostSproutSvg}>
        <line
          x1="10"
          y1="60"
          x2="10"
          y2="20"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          className={styles.ghostStem}
        />
        <path d="M 10 28 Q 18 22, 15 30 Q 12 29, 10 28" fill="currentColor" className={styles.ghostLeaf} />
        <path d="M 10 38 Q 2 31, 5 40 Q 8 40, 10 38" fill="currentColor" className={styles.ghostLeafSecond} />
        <path d="M 10 20 Q 3 14, 6 23 Q 9 23, 10 20" fill="currentColor" className={styles.ghostLeafThird} />
        <circle cx="10" cy="17" r="2.2" className={styles.ghostBud} />
      </svg>
    </div>
  )
}

export default function GardenScene({
  flowers,
  autoBloom,
  onAllBloomed,
  occasion,
  mood,
  sprouting = false,
  sealed = false,
  silent = false,
  compact = false,
  draftGrowth = 0,
  focused = null,
  onFocus,
  onFocusRelease,
  wateredAt = 0,
  journalGardenId,
  journalFrom,
  now = new Date(),
}: Props) {
  const sky = gradientFor(occasion)
  /* Size to the tallest flower, never a constant: stems run to 160 and a fixed plot clips the heads. */
  const gardenHeight = Math.max(GARDEN_MIN_HEIGHT, ...flowers.map(flowerBoxHeight))
  const hour = ritualTime(now)
  const time = TIME_SKY[hour]
  const isNight = hour === 'night'
  const sceneStyle: CSSProperties = {
    ['--sky-top' as string]: mixHex(sky.top, time.top, time.weight),
    ['--sky-bottom' as string]: mixHex(sky.bottom, time.bottom, time.weight),
    ['--sun-tint' as string]: time.sun,
    ['--sun-strength' as string]: String(time.sunStrength),
    ['--garden-h' as string]: `${gardenHeight}px`,
  }
  const [bloomedCount, setBloomedCount] = useState(0)
  const placed = placeFlowers(flowers)
  /* Focus returns to the flower that opened the panel, so tabbing carries on from there rather
     than restarting at the top of the page. */
  const slotRefs = useRef<Array<HTMLButtonElement | null>>([])
  /* A click focuses the button too, so a plain onFocus would set `focused` before onClick's toggle
     runs and the click would close what it just opened. `:focus-visible` excludes mouse clicks. */
  const previewedByKeyboard = useRef(false)
  const suppressNextPreview = useRef(false)
  const closeAndRestoreFocus = useCallback(() => {
    const previous = focused
    onFocus?.(null)
    // Handing focus back counts as keyboard focus, so without this the preview reopens the panel
    // Escape just closed.
    suppressNextPreview.current = true
    if (previous !== null) slotRefs.current[previous]?.focus()
  }, [focused, onFocus])

  const aura = auraFor(mood)

  /* A destination index plus a CSS transition, not a keyframe path: the flower count varies from
     three to five, so hand-authored @keyframes would be wrong for most gardens. */
  const [beeAt, setBeeAt] = useState(0)
  const beeFlying = autoBloom && placed.length > 0 && bloomedCount >= placed.length && !prefersReducedMotion()
  useEffect(() => {
    if (!beeFlying) return
    // Uneven dwell, on prime-ish numbers, so the bee never falls into step with the flowers' sway.
    const t = setInterval(() => setBeeAt((i) => (i + 1) % placed.length), 3700)
    return () => clearInterval(t)
  }, [beeFlying, placed.length])

  const [perking, setPerking] = useState(false)
  useEffect(() => {
    if (!wateredAt || prefersReducedMotion()) return
    setPerking(true)
    const t = setTimeout(() => setPerking(false), 1000)
    return () => clearTimeout(t)
  }, [wateredAt])

  // The cleanup makes this idempotent: timers from a prior run are torn down before a new run
  // schedules its own.
  const flowerSig = flowers.map((f) => f.name).join('|')

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
        setBloomedCount((prev) => {
          const next = prev + 1
          if (next === placed.length && onAllBloomed) {
            setTimeout(onAllBloomed, BLOOM_HOLD_MS)
          }
          return next
        })
      }, i * BLOOM_STAGGER_MS)
      timers.push(t)
    })

    return () => timers.forEach(clearTimeout)
    /*
     * `placed.length`, not `placed`. placeFlowers builds a new array every render, so depending on
     * the array itself restarts the bloom from sprout on any unrelated state change. The length is
     * the only thing this effect reads, and flowerSig already covers a genuinely new garden.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBloom, flowerSig, placed.length, onAllBloomed, silent])

  const drifters =
    autoBloom && flowers.length > 0
      ? PETAL_DRIFTERS.map((cfg, i) => {
          const flower = flowers[i % flowers.length]!
          return {
            ...cfg,
            color: flower.petalColors[i % flower.petalColors.length]!,
            key: `${flowerSig}-drift-${i}`,
          }
        })
      : []

  const showGhostSprout = flowers.length === 0

  // Skipped entirely under reduced motion. The CSS variable stays at its 0 fallback, so the
  // petals hold still rather than snapping.
  const sceneRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return

    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const el = sceneRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const inside =
          e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
        const x = inside ? ((e.clientX - r.left) / r.width) * 2 - 1 : 0
        const y = inside ? ((e.clientY - r.top) / r.height) * 2 - 1 : 0
        el.style.setProperty('--px', x.toFixed(3))
        el.style.setProperty('--py', y.toFixed(3))
      })
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])
  useEffect(() => {
    if (prefersReducedMotion()) return

    let raf = 0
    const apply = () => {
      raf = 0
      sceneRef.current?.style.setProperty('--scroll-y', `${window.scrollY}px`)
    }
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    // Sync the initial position, so a refresh partway down the page does not start the layer at 0.
    apply()

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      // Compact only ever applies to an empty plot, so a stale flag can never crop a real garden.
      className={compact && flowers.length === 0 ? `${styles.scene} ${styles.sceneCompact}` : styles.scene}
      ref={sceneRef}
      style={sceneStyle}
    >
      <div className={styles.sky} />
      {isNight && (
        <div className={styles.stars} aria-hidden>
          {STARS.map(([left, top, delay]) => (
            <span
              key={`${left}-${top}`}
              className={styles.star}
              style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      )}
      {aura && autoBloom && flowers.length > 0 && (
        <div className={`${styles.aura} ${aura.className}`} aria-hidden>
          {aura.marks.map((mark, index) => (
            <span key={`${mood}-${index}`} style={{ animationDelay: `${index * 430}ms` }}>
              {mark}
            </span>
          ))}
        </div>
      )}
      <div className={styles.garden}>
        {sealed && placed.length > 0 && <SeedBed placements={placed} />}
        {showGhostSprout &&
          (sprouting ? (
            <div className={styles.sproutRow} aria-hidden>
              {WAIT_SPROUTS.map(([left, scale, delay], i) => (
                <span
                  key={i}
                  className={styles.sproutSlot}
                  style={{
                    ['--left' as string]: `${left}%`,
                    ['--scale' as string]: String(scale),
                    ['--sprout-delay' as string]: `${delay}s`,
                  }}
                >
                  <GhostSprout growth={3} />
                </span>
              ))}
            </div>
          ) : (
            <GhostSprout growth={draftGrowth} />
          ))}
        {beeFlying &&
          (() => {
            const target = placed[beeAt % placed.length]!
            /* Height comes from the flower, not a constant. A fixed `bottom: 62%` fits whichever garden you
               happen to be testing and clips the rest. */
            const headUp = flowerHeadOffset(target.spec) - 8
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
        {placed.map((p, i) => {
          /* A flower is only a control once it has bloomed. The slots are in the DOM from the start so
             the bloom has something to animate, so they stay disabled and aria-hidden until then. */
          const revealed = i < bloomedCount
          return (
            <button
              type="button"
              disabled={!revealed}
              aria-hidden={revealed ? undefined : true}
              aria-label={`${p.spec.name}: ${p.spec.meaning}`}
              aria-expanded={focused === i}
              aria-controls="flower-peek"
              ref={(element) => {
                slotRefs.current[i] = element
              }}
              key={placementKey(p.spec, i)}
              className={
                (focused === i
                  ? `${styles.flowerSlot} ${styles.flowerSlotOn}`
                  : focused !== null
                    ? `${styles.flowerSlot} ${styles.flowerSlotOff}`
                    : styles.flowerSlot) + (perking ? ` ${styles.flowerSlotPerk}` : '')
              }
              // Focused flowers come forward, so a lifted flower is never behind its neighbour. The perk
              // waits out its own drop's fall, so each flower answers the water that hit it.
              style={{
                left: `${p.left}%`,
                // Focus lifts a flower clear of the whole depth stack, not just its neighbour.
                zIndex: focused === i ? 20 : p.zIndex,
                animationDelay: `${i * 90 + 460}ms`,
                ['--depth' as string]: String(p.depth),
              }}
              title={p.spec.name}
              onMouseEnter={revealed ? () => onFocus?.(i) : undefined}
              onMouseLeave={revealed ? () => onFocusRelease?.() : undefined}
              onFocus={
                revealed
                  ? (event) => {
                      if (suppressNextPreview.current) {
                        suppressNextPreview.current = false
                        return
                      }
                      if (!event.currentTarget.matches(':focus-visible')) return
                      previewedByKeyboard.current = true
                      onFocus?.(i)
                    }
                  : undefined
              }
              onBlur={
                revealed
                  ? () => {
                      if (!previewedByKeyboard.current) return
                      previewedByKeyboard.current = false
                      onFocusRelease?.()
                    }
                  : undefined
              }
              // Touch has no hover and this is mostly opened on a phone: tap to pick, tap again to let go,
              // so the link is reachable without a mouse.
              onClick={revealed ? () => onFocus?.(focused === i ? null : i) : undefined}
            >
              <FlowerSVG flower={p.spec} index={i} bloomed={revealed} swayDelay={i} />
            </button>
          )
        })}
      </div>
      {focused !== null && flowers[focused] && (
        <FlowerPeek
          key={focused}
          flower={flowers[focused]}
          index={focused}
          journalGardenId={journalGardenId}
          journalFrom={journalFrom}
          onClose={closeAndRestoreFocus}
          onHover={() => onFocus?.(focused)}
          onHoverEnd={() => onFocusRelease?.()}
        />
      )}
      {sealed && (
        <div className={styles.moteLayer} aria-hidden>
          {MOTES.map(([left, top, delay], i) => (
            <span
              key={i}
              className={styles.mote}
              style={{ left: `${left}%`, top: `${top}%`, animationDelay: `${delay}s` }}
            />
          ))}
        </div>
      )}
      <div className={styles.ground}>
        <div className={styles.groundTop} />
        <SoilLine />
        <div className={styles.groundBase} />
      </div>
      {drifters.length > 0 && (
        <div className={styles.petalLayer} aria-hidden>
          {drifters.map((p) => (
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
