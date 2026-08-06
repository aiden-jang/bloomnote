import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import styles from './ChipRow.module.css'

interface Props {
  /** Labels the group for screen readers — the id of the visible `occasion` / `mood` label. */
  labelledBy: string
  children: ReactNode
}

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
 * while a fade reads as "keeps going." They're masked per side and only appear on a side that has
 * something hidden, so a row that fits shows no fades at all and is indistinguishable from the
 * plain row it replaces.
 */
export default function ChipRow({ labelledBy, children }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [fade, setFade] = useState({ start: false, end: false })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    // 1px of slack: fractional layout means scrollLeft rarely lands exactly on 0 or max, and
    // without it a row scrolled fully to one end keeps a fade that points at nothing.
    setFade({ start: el.scrollLeft > 1, end: el.scrollLeft < max - 1 })
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

  return (
    <div
      ref={ref}
      className={styles.row}
      role="radiogroup"
      aria-labelledby={labelledBy}
      onScroll={measure}
      data-fade-start={fade.start || undefined}
      data-fade-end={fade.end || undefined}
    >
      {children}
    </div>
  )
}
