import { useCallback, useEffect, useState } from 'react'

const THINKING_MESSAGES = [
  'reading between the lines…',
  'choosing flowers…',
  'mixing the palette…',
  'arranging the bouquet…',
  'writing the note…',
]

export interface StatusLine {
  statusText: string
  /** Replace the line and stop any rotation. */
  say: (text: string) => void
  /** Rotate the thinking messages until something else is said. */
  think: () => void
}

/*
 * The one line under the spinner. Either it says a specific thing, or it cycles while the model
 * is thinking, and the caller should never have to remember to stop the cycle: saying anything
 * stops it, and so does leaving the designing phase.
 */
export function useStatusLine(designing: boolean): StatusLine {
  const [statusText, setStatusText] = useState('')
  const [thinking, setThinking] = useState(false)

  useEffect(() => {
    if (!thinking) return
    let i = 0
    setStatusText(THINKING_MESSAGES[0]!)
    const id = setInterval(() => {
      i = (i + 1) % THINKING_MESSAGES.length
      setStatusText(THINKING_MESSAGES[i]!)
    }, 2500)
    return () => clearInterval(id)
  }, [thinking])

  useEffect(() => {
    if (!designing) setThinking(false)
  }, [designing])

  const say = useCallback((text: string) => {
    setThinking(false)
    setStatusText(text)
  }, [])

  const think = useCallback(() => setThinking(true), [])

  return { statusText, say, think }
}
