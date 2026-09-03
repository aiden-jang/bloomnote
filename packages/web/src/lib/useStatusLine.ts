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
  say: (text: string) => void
  think: () => void
}

/* The one line under the spinner. Nothing has to remember to stop the cycle: saying anything
   stops it, and so does leaving the designing phase. */
export function useStatusLine(designing: boolean): StatusLine {
  const [statusText, setStatusText] = useState('')
  const [thinking, setThinking] = useState(false)
  // Both, so leaving the designing phase tears the interval down on its own. Clearing a flag
  // afterwards works until the one path that forgets, and then it rotates forever off-screen.
  const rotating = thinking && designing

  useEffect(() => {
    if (!rotating) return
    let i = 0
    setStatusText(THINKING_MESSAGES[0]!)
    const id = setInterval(() => {
      i = (i + 1) % THINKING_MESSAGES.length
      setStatusText(THINKING_MESSAGES[i]!)
    }, 2500)
    return () => clearInterval(id)
  }, [rotating])

  const say = useCallback((text: string) => {
    setThinking(false)
    setStatusText(text)
  }, [])

  const think = useCallback(() => setThinking(true), [])

  return { statusText, say, think }
}
