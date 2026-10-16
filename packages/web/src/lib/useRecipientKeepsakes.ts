import { useCallback, useEffect, useRef, useState } from 'react'
import type { GardenData } from '../garden'
import { saveGardenDuetImage, saveGardenImage } from './gardenImage'
import { trackCardDownloaded, trackGardenReshared } from './analytics'

export function useRecipientKeepsakes(gardenData: GardenData) {
  const { flowers, from, to, message, previous } = gardenData
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [shareError, setShareError] = useState<string | null>(null)
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )
  // Guard against a double-tap opening two share sheets, and swallow the rare canvas or decode
  // failure so it isn't an unhandled rejection.
  const savingImageRef = useRef(false)
  const savingDuetRef = useRef(false)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | 'copied' | null>(null)
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [duetStatus, setDuetStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [noteCopied, setNoteCopied] = useState(false)
  const handleSaveImage = useCallback(async () => {
    if (savingImageRef.current) return
    savingImageRef.current = true
    setShareError(null)
    setImageStatus('saving')
    try {
      const result = await saveGardenImage({ flowers, from, to })
      if (result === 'dismissed') {
        setImageStatus(null)
        return
      }
      setImageStatus(result)
      if (result === 'downloaded') trackCardDownloaded('recipient', 'square')
      timers.current.push(setTimeout(() => setImageStatus(null), 2500))
    } catch {
      setShareError('Couldn’t save the image. Try again, or share the link.')
      setImageStatus(null)
    } finally {
      savingImageRef.current = false
    }
  }, [flowers, from, to])
  const handleSaveDuet = useCallback(async () => {
    if (!previous || savingDuetRef.current) return
    savingDuetRef.current = true
    setShareError(null)
    setDuetStatus('saving')
    try {
      const result = await saveGardenDuetImage({ previous, current: gardenData })
      if (result === 'dismissed') {
        setDuetStatus(null)
        return
      }
      setDuetStatus(result)
      if (result === 'downloaded') trackCardDownloaded('recipient', 'duet')
      timers.current.push(setTimeout(() => setDuetStatus(null), 2500))
    } catch {
      setShareError('Couldn’t save both gardens. Try again, or share the link.')
      setDuetStatus(null)
    } finally {
      savingDuetRef.current = false
    }
  }, [gardenData, previous])
  const handleShareGarden = useCallback(
    async (trigger: HTMLButtonElement) => {
      if (shareStatus) return
      setShareError(null)
      setShareStatus('sharing')
      const shareData: ShareData = {
        title: 'bloomnote',
        text: from ? `A garden from ${from}` : 'A garden for you',
        url: window.location.href,
      }
      try {
        if (typeof navigator.share === 'function') {
          await navigator.share(shareData)
          setShareStatus('shared')
          trackGardenReshared('native')
        } else {
          await navigator.clipboard.writeText(window.location.href)
          setShareStatus('copied')
          trackGardenReshared('copy')
        }
        timers.current.push(setTimeout(() => setShareStatus(null), 2500))
      } catch (err) {
        // Closing a native sheet is a normal outcome, not an error. Leave the garden as it was.
        setShareStatus(null)
        requestAnimationFrame(() => {
          if (trigger.isConnected) trigger.focus()
        })
        if (err instanceof Error && err.name === 'AbortError') return
        setShareError('Couldn’t share. Copy the garden link below instead.')
      }
    },
    [from, shareStatus],
  )

  const handleCopyNote = useCallback(async () => {
    if (!message || noteCopied) return
    setShareError(null)
    try {
      await navigator.clipboard.writeText(`${message}${from ? `\n\n${from}` : ''}`)
      setNoteCopied(true)
      timers.current.push(setTimeout(() => setNoteCopied(false), 2200))
    } catch {
      setShareError('Couldn’t copy. Select the note and copy it, or try again.')
    }
  }, [from, message, noteCopied])

  return {
    shareStatus,
    imageStatus,
    duetStatus,
    noteCopied,
    shareError,
    handleSaveImage,
    handleSaveDuet,
    handleShareGarden,
    handleCopyNote,
  }
}
