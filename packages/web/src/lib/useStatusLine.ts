import { useCallback, useState } from 'react'

export interface StatusLine {
  statusText: string
  say: (text: string) => void
  think: () => void
}

export function useStatusLine(): StatusLine {
  const [statusText, setStatusText] = useState('')
  const say = useCallback((text: string) => setStatusText(text), [])
  const think = useCallback(() => setStatusText('choosing flowers…'), [])
  return { statusText, say, think }
}
