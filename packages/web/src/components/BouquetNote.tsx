import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'
import styles from './BouquetNote.module.css'

interface Props {
  note: string
  start?: boolean
}

// ~22ms reads as a brisk stream: fast enough not to test patience, slow enough to feel written.
const TYPE_MS = 22

export default function BouquetNote({ note, start = true }: Props) {
  const text = note.trim()
  const reduced = prefersReducedMotion()
  const [count, setCount] = useState(reduced ? text.length : 0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!text) return
    if (reduced) {
      setCount(text.length)
      return
    }
    if (!start) {
      setCount(0)
      return
    }
    setCount(0)
    timerRef.current = setInterval(() => {
      setCount((c) => {
        if (c >= text.length) {
          if (timerRef.current) clearInterval(timerRef.current)
          return c
        }
        return c + 1
      })
    }, TYPE_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [text, start, reduced])

  if (!text) return null

  const typing = count < text.length

  return (
    <div className={styles.wrap}>
      <p className={styles.label}>
        <span className={styles.sparkle} aria-hidden>
          ✦
        </span>
        why this garden
      </p>
      <p className={styles.text}>
        <span aria-hidden>{text.slice(0, count)}</span>
        {typing && <span className={styles.cursor} aria-hidden />}
        {/* Full text for screen readers. The visible stream is hidden from them, because a character at
            a time reads as gibberish. */}
        <span className={styles.srOnly}>{text}</span>
      </p>
    </div>
  )
}
