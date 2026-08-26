import { useState, useEffect, useRef, type CSSProperties } from 'react'
import FlowerSVG, { FlowerHead, flowerBoxHeight, flowerHeadOffset } from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { prefersReducedMotion } from '../lib/motion'
import { ritualTime, type RitualTime } from '../lib/rituals'
import { playBloom, pulse } from '../sound'
import { withoutLeadingFlowerName } from '../lib/flowerMeaning'
import { saveFlowerImage } from '../lib/gardenImage'
import { flowerJournalEntry, saveFlowerJournalEntry } from '../lib/flowerJournal'
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
/** An empty or sprouting plot still wants a plot-sized bed. */
const GARDEN_MIN_HEIGHT = 200

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

/**
 * The mood is a second, quieter visual axis than the occasion. Occasion paints the sky; mood adds
 * a small living detail to it. Keeping the vocabulary allowlisted means an old or hand-crafted
 * garden can never turn an arbitrary stored string into a CSS class.
 */
const MOOD_AURAS = {
  tender: { className: styles.auraTender, marks: ['♡', '·', '♡', '·', '♡', '·'] },
  playful: { className: styles.auraPlayful, marks: ['✦', '●', '✦', '●', '✦', '●'] },
  wistful: { className: styles.auraWistful, marks: ['·', '◦', '·', '◦', '·', '◦'] },
  celebratory: { className: styles.auraCelebratory, marks: ['✦', '✧', '✦', '✧', '✦', '✧'] },
  steady: { className: styles.auraSteady, marks: ['•', '·', '•', '·', '•', '·'] },
} as const

function auraFor(mood?: string) {
  return mood && mood in MOOD_AURAS ? MOOD_AURAS[mood as keyof typeof MOOD_AURAS] : null
}

/*
 * The hour the garden is opened, folded into the occasion's sky.
 *
 * `ritualTime` already told the composer what time it was and shaped the copy around it; the sky
 * ignored it, so a garden opened at one in the morning arrived under a bright noon blue. Occasion
 * still owns the hue — it is the emotional signal and must survive — so the time is a blend toward
 * a base rather than a replacement, and morning leaves the authored colours untouched.
 */
const TIME_SKY: Record<RitualTime, { top: string; bottom: string; weight: number; sun: string; sunStrength: number }> = {
  morning:   { top: '#ffffff', bottom: '#ffffff', weight: 0,    sun: '255, 250, 235', sunStrength: 0.72 },
  afternoon: { top: '#fff6df', bottom: '#fffaf0', weight: 0.12, sun: '255, 248, 226', sunStrength: 0.78 },
  evening:   { top: '#f0a679', bottom: '#f8d9b4', weight: 0.42, sun: '255, 214, 170', sunStrength: 0.62 },
  night:     { top: '#1d2742', bottom: '#33395a', weight: 0.74, sun: '206, 219, 255', sunStrength: 0.20 },
}

/** left %, top %, twinkle delay. Placed by hand so a garden looks the same every time it opens. */
const STARS: Array<[number, number, number]> = [
  [8, 14, 0], [21, 31, 1.6], [34, 9, 0.8], [46, 24, 2.4],
  [58, 12, 1.1], [12, 44, 3.1], [67, 34, 0.4], [29, 52, 2.0],
  [52, 44, 1.4], [41, 38, 2.8],
]

/** Two hex colours, blended. `t` of 0 is all `a`, 1 is all `b`. */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${ch(ar!, br!)}${ch(ag!, bg!)}${ch(ab!, bb!)}`
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
  /** 1 is nearest the viewer, lower is further back. Drives scale, ground position and haze. */
  depth: number
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
  /** Adds a restrained, animated atmosphere. Old gardens without a mood stay unchanged. */
  mood?: string | undefined
  /**
   * The model is designing the garden right now. The bed answers by putting up a row of sprouts.
   */
  sprouting?: boolean
  /**
   * The garden is written but not yet opened. The flowers are withheld, so the plot draws the seeds
   * they will grow from instead of an empty bed.
   */
  sealed?: boolean
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
  /** Recipient-only identity for keeping individual flowers on this device. */
  journalGardenId?: string | undefined
  journalFrom?: string | undefined
  /** Injectable clock, so the sky's hour can be pinned in a test or a static render. */
  now?: Date
}

/*
 * Depth per flower, by how many there are.
 *
 * Every flower used to sit at one scale on one plane, evenly spaced far enough apart that nothing
 * ever overlapped — a row of stickers rather than a garden. Real planting has a front and a back.
 *
 * Hand-written rather than computed so neighbours always differ: alternating near and far is what
 * makes an overlap read as one flower in front of another, instead of two colliding. Each row also
 * gives exactly one flower depth 1, so there is a subject.
 */
const DEPTHS: Record<number, number[]> = {
  1: [1],
  2: [1, 0.74],
  3: [0.74, 1, 0.82],
  4: [0.7, 1, 0.76, 0.9],
  5: [0.68, 0.9, 1, 0.74, 0.84],
}

/** Nudges so the row is not a perfect arithmetic progression. Deterministic, like the petal drift. */
const LEFT_JITTER = [0, 2.4, -1.8, 1.2, -2.6]

function placeFlowers(flowers: FlowerSpec[]): Placement[] {
  const count = flowers.length
  if (count === 0) return []

  // Tighter than the old 80: at this spread the sprites genuinely overlap, which is the point.
  const spread = 70
  const center = 50
  const step = count > 1 ? spread / (count - 1) : 0
  const start = center - spread / 2
  const depths = DEPTHS[count] ?? flowers.map(() => 1)

  return flowers.map((spec, i) => {
    const depth = depths[i] ?? 1
    return {
      spec,
      left: count === 1 ? center : start + i * step + (LEFT_JITTER[i] ?? 0),
      // Nearer flowers occlude further ones. Focus still lifts a flower above all of them.
      zIndex: Math.round(depth * 10),
      depth,
    }
  })
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

/*
 * The waiting bed while the model works. left %, scale, delay s.
 *
 * One sprout in the middle of an empty plot is the right idea for someone still writing; it is a
 * thin answer to someone who has pressed the button and is now watching that plot, waiting for a
 * whole garden. Staggered so they come up in sequence rather than as a row of copies.
 */
const WAIT_SPROUTS: Array<[number, number, number]> = [
  [16, 0.78, 0], [31, 1, 0.55], [50, 0.88, 1.1], [68, 1.05, 0.3], [84, 0.74, 0.85],
]

/** Hand-placed so the sky is unevenly filled, the way real drifting things are. left %, top %, delay s. */
const MOTES: Array<[number, number, number]> = [
  [14, 22, 0], [31, 46, 2.7], [48, 16, 5.1], [63, 38, 1.4],
  [77, 27, 3.9], [88, 52, 6.3], [22, 63, 4.6],
]

/**
 * The sealed plot.
 *
 * Before it is opened the bed was bare: a gradient, some soil, and a button. That reads as a page
 * that has not loaded rather than as a gift being withheld. Each flower puts a seed in its own
 * column, in its own colour, so the reveal grows out of something the recipient was already looking
 * at, and the wait has a subject.
 */
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
            // Staggered so the bed breathes in sequence rather than pulsing as one block.
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

export default function GardenScene({ flowers, autoBloom, onAllBloomed, occasion, mood, sprouting = false, sealed = false, silent = false, compact = false, draftGrowth = 0, focused = null, onFocus, wateredAt = 0, journalGardenId, journalFrom, now = new Date() }: Props) {
  // Resolve the gradient once per render; the cost is a Record lookup,
  // not enough to justify memoization. Inline `--sky-top` / `--sky-bottom`
  // get consumed by the CSS module on the .sky element.
  const sky = gradientFor(occasion)
  /*
   * The plot sizes to its tallest flower rather than to a constant.
   *
   * FlowerSVG draws into a box that grows with `stemHeight`, and `stemHeight` is authored up to
   * 160, so a tall garden needs about 240px where the fixed plot gave it 200. The heads that
   * exceeded it were clipped by `overflow: hidden` on a phone and spilled onto the page on a
   * desktop. `flowerBoxHeight` is the one number both sides now agree on.
   */
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
  const [flowerShareStatus, setFlowerShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)
  const [flowerImageStatus, setFlowerImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [journalOpen, setJournalOpen] = useState(false)
  const [journalMemory, setJournalMemory] = useState('')
  const [journalSaved, setJournalSaved] = useState(false)
  const placed = placeFlowers(flowers)
  const aura = auraFor(mood)

  useEffect(() => {
    setFlowerShareStatus(null)
    setFlowerImageStatus(null)
    setJournalOpen(false)
    const existing = focused !== null && journalGardenId
      ? flowerJournalEntry(journalGardenId, focused)
      : null
    setJournalMemory(existing?.memory ?? '')
    setJournalSaved(existing !== null)
  }, [focused, journalGardenId])

  const shareFocusedFlower = async (): Promise<void> => {
    const flower = focused === null ? null : flowers[focused]
    if (!flower || flowerShareStatus) return
    const meaning = withoutLeadingFlowerName(flower.name, flower.meaning)
    const text = `${flower.name}: ${meaning}`
    const finish = (status: 'shared' | 'copied'): void => {
      setFlowerShareStatus(status)
      window.setTimeout(() => setFlowerShareStatus(null), 2200)
    }
    setFlowerShareStatus('sharing')
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: flower.name, text, url: window.location.href })
        finish('shared')
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setFlowerShareStatus(null)
          return
        }
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      finish('copied')
    } catch {
      setFlowerShareStatus(null)
    }
  }

  const saveFocusedFlower = async (): Promise<void> => {
    const flower = focused === null ? null : flowers[focused]
    if (!flower || flowerImageStatus) return
    setFlowerImageStatus('saving')
    try {
      const meaning = withoutLeadingFlowerName(flower.name, flower.meaning)
      const result = await saveFlowerImage(flower, meaning)
      if (result === 'dismissed') {
        setFlowerImageStatus(null)
        return
      }
      setFlowerImageStatus(result)
      window.setTimeout(() => setFlowerImageStatus(null), 2200)
    } catch {
      setFlowerImageStatus(null)
    }
  }

  const keepFocusedFlower = (): void => {
    if (focused === null || !journalGardenId) return
    const flower = flowers[focused]
    if (!flower) return
    saveFlowerJournalEntry({
      gardenId: journalGardenId,
      flowerIndex: focused,
      flower,
      memory: journalMemory,
      from: journalFrom,
    })
    setJournalSaved(true)
    setJournalOpen(false)
  }

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

  /*
   * Depth, from wherever the visitor is pointing.
   *
   * Layers move at different rates against the pointer, which is what puts air between them.
   * Written straight to the element as CSS variables rather than held in state: a pointermove that
   * re-renders four flowers and their petals every frame is a dropped frame, and none of this is
   * information React needs.
   *
   * Listener on the window with the ref read lazily, like the scroll effect below. Capturing
   * `sceneRef.current` at effect time gives null — the scene root is not mounted on this
   * component's first render — and with an empty dep list it would never look again.
   *
   * Coarse pointers get nothing here; the petals already lag the scroll below. Reduced motion gets
   * nothing either, and the layers stay where they were drawn.
   */
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
      {focused !== null && flowers[focused] && (
        <aside className={styles.flowerPeek} aria-live="polite">
          <span className={styles.flowerPeekSwatches} aria-hidden>
            <FlowerHead flower={flowers[focused]} size={30} />
          </span>
          <span className={styles.flowerPeekCopy}>
            <strong>{flowers[focused].name}</strong>
            <span>{withoutLeadingFlowerName(flowers[focused].name, flowers[focused].meaning)}</span>
            <button
              type="button"
              className={styles.flowerPeekShare}
              onClick={() => void shareFocusedFlower()}
              disabled={flowerShareStatus !== null}
            >
              {flowerShareStatus === 'sharing'
                ? 'opening…'
                : flowerShareStatus === 'shared'
                  ? 'shared'
                  : flowerShareStatus === 'copied'
                    ? 'meaning copied'
                    : 'share this flower'}
            </button>
            <button
              type="button"
              className={styles.flowerPeekShare}
              onClick={() => void saveFocusedFlower()}
              disabled={flowerImageStatus !== null}
            >
              {flowerImageStatus === 'saving'
                ? 'pressing flower…'
                : flowerImageStatus === 'shared'
                  ? 'keepsake shared'
                  : flowerImageStatus === 'downloaded'
                    ? 'keepsake saved'
                    : 'save a pressed-flower card'}
            </button>
            {journalGardenId && (
              <>
                <button
                  type="button"
                  className={styles.flowerPeekShare}
                  onClick={() => setJournalOpen(open => !open)}
                  aria-expanded={journalOpen}
                >
                  {journalSaved ? 'edit journal memory' : 'keep in my flower journal'}
                </button>
                {journalOpen && (
                  <div className={styles.journalEditor}>
                    <label htmlFor={`flower-memory-${focused}`}>what do you want to remember?</label>
                    <textarea
                      id={`flower-memory-${focused}`}
                      value={journalMemory}
                      onChange={event => setJournalMemory(event.target.value)}
                      maxLength={240}
                      rows={2}
                      placeholder="the moment, the person, the reason…"
                      autoFocus
                    />
                    <div>
                      <span>{journalMemory.length}/240</span>
                      <button type="button" onClick={keepFocusedFlower}>
                        {journalSaved ? 'update memory' : 'press into journal'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </span>
          <button type="button" className={styles.flowerPeekClose} onClick={() => onFocus?.(null)} aria-label="Close flower meaning">
            ×
          </button>
        </aside>
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
              // Focus lifts a flower clear of the whole depth stack, not just its neighbour.
              zIndex: focused === i ? 20 : p.zIndex,
              animationDelay: `${i * 90 + 460}ms`,
              ['--depth' as string]: String(p.depth),
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
