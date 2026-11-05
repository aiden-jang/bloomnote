import { useEffect, useState } from 'react'
import styles from './AppUpdate.module.css'

export function AppUpdate({ safe = true }: { safe?: boolean }) {
  const [available, setAvailable] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => {
    const current = document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src
    if (!current) return
    const controller = new AbortController()
    let checking = false
    let checkedAt = 0
    const check = async () => {
      if (document.hidden || !navigator.onLine || checking || Date.now() - checkedAt < 60_000) return
      checkedAt = Date.now()
      checking = true
      try {
        const response = await fetch('/', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'text/html' },
        })
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return
        const next = new DOMParser()
          .parseFromString(await response.text(), 'text/html')
          .querySelector('script[type="module"][src]')
          ?.getAttribute('src')
        if (
          next &&
          new URL(next, location.origin).origin === location.origin &&
          new URL(next, location.origin).href !== current &&
          !controller.signal.aborted
        )
          setAvailable(true)
      } catch {
        // Update discovery must never interrupt offline work or an active session.
      } finally {
        checking = false
      }
    }
    window.addEventListener('focus', check)
    window.addEventListener('online', check)
    document.addEventListener('visibilitychange', check)
    return () => {
      controller.abort()
      window.removeEventListener('focus', check)
      window.removeEventListener('online', check)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  if (!safe || !available || dismissed) return null
  return (
    <aside aria-label="App update" role="status" className={styles.notice}>
      <p className={styles.title}>An update is ready.</p>
      <p>Save your changes before reloading. This page stays open until you choose.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.reload} onClick={() => window.location.reload()}>
          Reload app
        </button>
        <button type="button" className={styles.later} onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </aside>
  )
}
