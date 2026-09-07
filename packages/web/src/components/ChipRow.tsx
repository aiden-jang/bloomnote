import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import styles from './ChipRow.module.css'

interface Props {
  labelledBy: string
  selectable?: boolean
  children: ReactNode
}

const FADE_PX = 28

/** Past this much movement a mouse drag is a scroll, not a click on the chip underneath. */
const DRAG_SLOP_PX = 4

export default function ChipRow({ labelledBy, selectable = true, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  /* Only the chosen chip is tabbable, so the whole row is one stop on the way down the page. */
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
    // without it a row scrolled fully to one end keeps a fade pointing at nothing.
    const hiddenStart = el.scrollLeft > 1 ? el.scrollLeft : 0
    const hiddenEnd = el.scrollLeft < max - 1 ? max - el.scrollLeft : 0
    el.style.setProperty('--fade-start', `${Math.min(FADE_PX, hiddenStart)}px`)
    el.style.setProperty('--fade-end', `${Math.min(FADE_PX, hiddenEnd)}px`)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    // Resize as well as scroll. The fades depend on whether the content overflows, and that changes
    // when the window resizes or a font finally loads, with no scroll event to announce it.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)
    return () => ro.disconnect()
  }, [measure, children])

  /* Bound natively rather than through React props, so the click suppression can run in the
     capture phase before React's synthetic handler fires. */
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0
    let startScroll = 0
    let dragging = false
    let moved = 0

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      if (el.scrollWidth <= el.clientWidth) return
      dragging = true
      moved = 0
      startX = e.clientX
      startScroll = el.scrollLeft
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      const dx = e.clientX - startX
      moved = Math.max(moved, Math.abs(dx))
      /* Never capture on the press: a capture here retargets the click to this row, so a plain
         click never reaches the chip. Only bites where the row scrolls, so a wide window hides it. */
      if (moved > DRAG_SLOP_PX && !el.hasPointerCapture(e.pointerId)) {
        el.setPointerCapture(e.pointerId)
        el.dataset.dragging = 'true'
      }
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

  /* The keyboard half of role="radiogroup": one tab stop for the row, arrows move within it. */
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
