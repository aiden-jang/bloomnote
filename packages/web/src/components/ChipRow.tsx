import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import styles from './ChipRow.module.css'

interface Props {
  /** Labels the group for screen readers — the id of the visible `occasion` / `mood` label. */
  labelledBy: string
  /**
   * Whether the chips are a single choice among many.
   *
   * True gives the row radio-group semantics: arrows move between chips and select as they go.
   * Leave it off for rows that are not a choice, like the watering feelings, where each tap is
   * irreversible and arrowing past one would send it.
   */
  selectable?: boolean
  children: ReactNode
}

/** How wide the edge fade gets once there's at least this much hidden past it. */
const FADE_PX = 28

/** Past this much movement a mouse drag is a scroll, not a click on the chip underneath. */
const DRAG_SLOP_PX = 4

/**
 * A single-line row of selectable chips that scrolls sideways when the options don't fit.
 *
 * They used to wrap. The composer column is capped around 520px, and the seven occasion chips
 * need ~541px, so occasion always spilled onto a second line — on every screen size, because the
 * cap means a wider window doesn't help. One chip alone on a second row reads like a mistake, and
 * it pushed the note field further down the page.
 *
 * Wrapping is the wrong shape for this anyway. These are one-of-N picks along a single axis, so a
 * row that runs off the edge is honest about there being more, where a ragged second line just
 * looks unplanned.
 *
 * The fades are the whole affordance: a hard cut at the edge is ambiguous (is that the last one?)
 * while a fade reads as "keeps going." They're masked per side, and sized to how much is actually
 * hidden rather than snapping to a fixed width, because a 28px fade over 14px of hidden content
 * dims a chip you can already see and reads as a rendering fault instead of an invitation.
 *
 * Drag-to-scroll is here because a mouse could not reach the hidden chips at all. The scrollbar is
 * deliberately hidden, a vertical wheel does nothing to a horizontal scroller, and shift+wheel is
 * not a gesture anyone tries. Touch had always been fine, so the row looked simply broken on the
 * desktop it was designed on. Dragging is the safe fix rather than translating wheel deltas:
 * hijacking the wheel would steal page scroll from anyone whose cursor happens to cross the row
 * mid-flick, which trades a reachability bug for a much more annoying one.
 */
export default function ChipRow({ labelledBy, selectable = true, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  /* Only the chosen chip is tabbable, so the whole row is a single stop on the way down the page. */
  useEffect(() => {
    const row = ref.current
    if (!row || !selectable) return
    const apply = (): void => {
      const radios = Array.from(row.querySelectorAll<HTMLElement>('[role="radio"]'))
      const checked = radios.findIndex((radio) => radio.getAttribute('aria-checked') === 'true')
      const stop = checked === -1 ? 0 : checked
      radios.forEach((radio, index) => {
        radio.tabIndex = index === stop ? 0 : -1
      })
    }
    apply()
    // Watching aria-checked keeps the tab stop on the chosen chip without ChipRow having to know
    // what the chips are.
    const observer = new MutationObserver(apply)
    observer.observe(row, { subtree: true, attributes: true, attributeFilter: ['aria-checked'] })
    return () => observer.disconnect()
  }, [selectable])

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // 1px of slack: fractional layout means scrollLeft rarely lands exactly on 0 or max, and
    // without it a row scrolled fully to one end keeps a fade that points at nothing.
    const hiddenStart = el.scrollLeft > 1 ? el.scrollLeft : 0
    const hiddenEnd = el.scrollLeft < max - 1 ? max - el.scrollLeft : 0
    el.style.setProperty('--fade-start', `${Math.min(FADE_PX, hiddenStart)}px`)
    el.style.setProperty('--fade-end', `${Math.min(FADE_PX, hiddenEnd)}px`)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    // Resize as well as scroll: the fades depend on whether the content overflows, and that
    // changes when the window resizes or a font finally loads, with no scroll event to announce it.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [measure, children])

  /*
   * Mouse drag scrolling.
   *
   * Bound natively rather than through React props for one reason: the click suppression has to run
   * in the capture phase to beat the chip's own onClick, and React's onClickCapture still fires
   * after the browser has already dispatched to the target in some orderings. Restricted to mouse
   * because touch already scrolls this natively, and taking over pointermove there would break it.
   */
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0
    let startScroll = 0
    let dragging = false
    let moved = 0

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      if (el.scrollWidth <= el.clientWidth) return // nothing hidden, leave clicks alone
      dragging = true
      moved = 0
      startX = e.clientX
      startScroll = el.scrollLeft
      el.setPointerCapture(e.pointerId)
      el.dataset.dragging = 'true'
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      moved = Math.max(moved, Math.abs(dx))
      el.scrollLeft = startScroll - dx
    }

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      delete el.dataset.dragging
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }

    // A drag that ends over a chip would otherwise select whatever it landed on.
    const onClickCapture = (e: MouseEvent) => {
      if (moved > DRAG_SLOP_PX) {
        e.stopPropagation()
        e.preventDefault()
      }
      moved = 0
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('click', onClickCapture, true)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  /* The keyboard half of `role="radiogroup"`: one tab stop for the row, arrows move within it. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    const row = ref.current
    if (!row || !selectable) return
    const radios = Array.from(row.querySelectorAll<HTMLElement>('[role="radio"]'))
    if (radios.length === 0) return

    const current = radios.indexOf(document.activeElement as HTMLElement)
    let next: number
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = radios.length - 1
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = ((current < 0 ? -1 : current) + 1 + radios.length) % radios.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = ((current < 0 ? 1 : current) - 1 + radios.length) % radios.length
    else return

    event.preventDefault()
    const target = radios[next]
    if (!target) return
    // Arrowing selects as it moves, which is what a radio group does.
    target.focus()
    target.click()
  }

  return (
    <div
      ref={ref}
      className={styles.row}
      role={selectable ? 'radiogroup' : 'group'}
      aria-labelledby={labelledBy}
      onScroll={measure}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  )
}
