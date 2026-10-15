import { useCallback, useEffect, useRef, useState } from 'react'
import type { FlowerSpec } from '../garden'
import { saveGardenImage } from './gardenImage'
import { trackCardDownloaded, trackShareLinkCopied, trackShareLinkShared } from './analytics'

export interface ShareActions {
  copied: boolean
  shareStatus: 'sharing' | 'shared' | null
  imageStatus: 'saving' | 'shared' | 'downloaded' | null
  canShare: boolean
  shareError: string | null
  handleCopy: () => Promise<void>
  handleShare: () => Promise<void>
  handleSaveImage: () => Promise<void>
}

const FLASH_MS = 2500

export function useShareActions(
  shareUrl: string | null,
  recipient: string,
  from: string,
  flowers: FlowerSpec[],
): ShareActions {
  const [copied, setCopied] = useState(false)
  const [shareStatus, setShareStatus] = useState<'sharing' | 'shared' | null>(null)
  const [imageStatus, setImageStatus] = useState<'saving' | 'shared' | 'downloaded' | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const currentUrl = useRef(shareUrl)
  useEffect(() => {
    currentUrl.current = shareUrl
    setCopied(false)
    setShareStatus(null)
    setImageStatus(null)
    setShareError(null)
    return () => {
      currentUrl.current = null
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [shareUrl])

  // Detected in an effect, not at render: `typeof navigator` can throw under some SSR pre-renders,
  // and a share button that does nothing is worse than no button.
  const [canShare, setCanShare] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
  }, [])

  const savingImageRef = useRef(false)

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return
    setShareError(null)
    try {
      await navigator.clipboard.writeText(shareUrl)
      if (currentUrl.current !== shareUrl) return
      setCopied(true)
      timers.current.push(setTimeout(() => setCopied(false), FLASH_MS))
      trackShareLinkCopied()
    } catch {
      if (currentUrl.current === shareUrl)
        setShareError('Couldn’t copy. Select the link above and copy it, or try again.')
    }
  }, [shareUrl])

  const handleShare = useCallback(async () => {
    if (!shareUrl) return
    setShareError(null)
    setShareStatus('sharing')
    const data: ShareData = {
      title: 'bloomnote',
      text: recipient.trim() ? `A garden for ${recipient.trim()}` : 'A garden for you',
      url: shareUrl,
    }
    try {
      await navigator.share(data)
      if (currentUrl.current !== shareUrl) return
      setShareStatus('shared')
      timers.current.push(setTimeout(() => setShareStatus(null), FLASH_MS))
      trackShareLinkShared()
    } catch (err) {
      if (currentUrl.current !== shareUrl) return
      setShareStatus(null)
      // Closing the sheet is a decision, not a failure. Anything else still leaves Copy.
      if (err instanceof Error && err.name === 'AbortError') return
      setShareError('Couldn’t open sharing. Copy the link instead.')
    }
  }, [shareUrl, recipient])

  const handleSaveImage = useCallback(async () => {
    if (!flowers.length || savingImageRef.current) return
    savingImageRef.current = true
    setShareError(null)
    setImageStatus('saving')
    try {
      const result = await saveGardenImage({ flowers, from: from.trim(), to: recipient.trim() })
      if (result === 'dismissed') {
        setImageStatus(null)
        return
      }
      setImageStatus(result)
      if (result === 'downloaded') trackCardDownloaded('composer', 'square')
      timers.current.push(setTimeout(() => setImageStatus(null), FLASH_MS))
    } catch {
      setImageStatus(null)
      setShareError('Couldn’t save the image. Try again, or send the link.')
    } finally {
      savingImageRef.current = false
    }
  }, [flowers, from, recipient])

  return { copied, shareStatus, imageStatus, canShare, shareError, handleCopy, handleShare, handleSaveImage }
}
