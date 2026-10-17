import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import FlowerSVG, { flowerBoxHeight, flowerHeadOffset } from './FlowerSVG'
import { type FlowerSpec } from '../garden'
import { useSceneMotion } from '../lib/useSceneMotion'
import { prefersReducedMotion } from '../lib/motion'
import { ritualTime } from '../lib/rituals'
import { playBloom, pulse } from '../sound'
import FlowerPeek from './FlowerPeek'
import {
  auraFor,
  TIME_SKY,
  STARS,
  PETAL_DRIFTERS,
  WAIT_SPROUTS,
  MOTES,
  Bee,
  SoilLine,
  SeedBed,
  GhostSprout,
} from './GardenScenery'
import styles from './GardenScene.module.css'
import { gradientFor, mixHex, placeFlowers, placementKey } from '../lib/scene'

const GARDEN_MIN_HEIGHT = 200

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

    Array.from({ length: placed.length }, (_, i) => {
      const t = setTimeout(() => {
        if (!silent) {
          playBloom(i)
          pulse()
        }
        setBloomedCount(i + 1)
      }, i * BLOOM_STAGGER_MS)
      timers.push(t)
    })
    if (placed.length > 0 && onAllBloomed) {
      timers.push(setTimeout(onAllBloomed, (placed.length - 1) * BLOOM_STAGGER_MS + BLOOM_HOLD_MS))
    }

    return () => timers.forEach(clearTimeout)
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

  const sceneRef = useRef<HTMLDivElement>(null)
  useSceneMotion(sceneRef)

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
              onMouseEnter={
                revealed
                  ? () => {
                      // Touch browsers synthesize mouse entry before a tap; opening here can cover its target.
                      if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) onFocus?.(i)
                    }
                  : undefined
              }
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
