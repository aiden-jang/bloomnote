import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  downloadGardenBackup,
  readGardenBackup,
  restoreGardenBackup,
  saveGardenBackup,
} from '../lib/gardenBackup'
import styles from './BackupRestore.module.css'

type Preview = Awaited<ReturnType<typeof readGardenBackup>>
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

type Phase = 'ready' | 'reading' | 'downloading' | 'restoring'

export default function BackupRestore({
  onRestored,
  blocked = false,
}: {
  onRestored?: () => void
  blocked?: boolean
}) {
  const { user, sessionError, login } = useAuth()
  const [phase, setPhase] = useState<Phase>('ready')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [voices, setVoices] = useState(typeof indexedDB !== 'undefined')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const accountId = user?.id ?? null
  useEffect(
    () => () => {
      active.current?.abort()
      active.current = null
    },
    [accountId],
  )
  const busy = phase !== 'ready'
  const start = (next: Phase) => {
    active.current?.abort()
    const controller = new AbortController()
    active.current = controller
    setPhase(next)
    setError(null)
    setMessage(
      next === 'reading'
        ? 'Reading the file…'
        : next === 'restoring'
          ? 'Keeping your copies…'
          : 'Preparing your backup…',
    )
    return controller
  }
  const current = (controller: AbortController) => active.current === controller && !controller.signal.aborted
  const failed = (controller: AbortController, e: unknown) => {
    if (!current(controller)) return
    setError(e instanceof Error ? e.message : 'Could not finish. Try again.')
    setMessage('')
  }
  const finish = (controller: AbortController) => {
    if (active.current === controller) setPhase('ready')
  }

  return (
    <details className={styles.wrap}>
      <summary>backup & restore</summary>
      <div className={styles.content}>
        <h2 className={styles.sectionTitle}>Download a backup</h2>
        <p>
          Keep the full contents of the gardens in your {user ? 'account library' : 'device library'} as a
          JSON file, including replies and secret notes. Keep the file private.
        </p>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={voices}
            disabled={busy}
            onChange={(event) => setVoices(event.target.checked)}
          />
          Include voice memories from this device
        </label>
        <p className={styles.hint}>
          Voices stay on the device where you recorded them. Preview images can be made again from the garden
          content.
        </p>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || blocked || sessionError}
          onClick={async () => {
            const controller = start('downloading')
            try {
              const backup = await downloadGardenBackup(accountId, voices, controller.signal, (value) => {
                if (current(controller)) setMessage(value)
              })
              if (!current(controller)) return
              saveGardenBackup(backup)
              setMessage(`Backup download started. ${count(backup.entries.length, 'garden')} kept.`)
            } catch (e) {
              failed(controller, e)
            } finally {
              finish(controller)
            }
          }}
        >
          Download JSON backup
        </button>
        {blocked && <p className={styles.hint}>Wait for your library change to finish before backing up.</p>}
        {sessionError && (
          <p role="alert">Sign-in could not be checked. Retry it before backing up or restoring.</p>
        )}
        <div className={styles.restore}>
          <h2 className={styles.sectionTitle}>Restore from a file</h2>
          {user ? (
            <>
              <p>Read a file first, then confirm the copies to keep in this account.</p>
              <label className={styles.file}>
                Choose a JSON backup
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={busy || sessionError}
                  onChange={async (event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (!file) return
                    const controller = start('reading')
                    setPreview(null)
                    try {
                      const value = await readGardenBackup(file)
                      if (!current(controller)) return
                      setPreview(value)
                      setMessage('Preview ready. No copies have been created.')
                    } catch (e) {
                      failed(controller, e)
                    } finally {
                      finish(controller)
                    }
                  }}
                />
              </label>
            </>
          ) : (
            <p>
              <button type="button" className={styles.link} onClick={() => login()}>
                Sign in
              </button>{' '}
              to restore copies to your library.
            </p>
          )}
          {preview && user && (
            <section className={styles.preview} aria-label="Backup preview">
              <h3>{count(preview.backup.entries.length, 'garden')} to keep</h3>
              <p>
                {preview.backup.entries.filter((e) => e.libraries.includes('sent')).length} sent ·{' '}
                {preview.backup.entries.filter((e) => e.libraries.includes('received')).length} received ·{' '}
                {count(
                  preview.backup.entries.filter((e) => e.voice).length,
                  'voice memory',
                  'voice memories',
                )}
              </p>
              <ul>
                {preview.backup.entries.slice(0, 5).map((entry) => (
                  <li key={entry.id}>
                    {entry.garden.to ? `for ${entry.garden.to}` : `from ${entry.garden.from || 'someone'}`}
                  </li>
                ))}
              </ul>
              <p>
                Restores new copies to {user.displayName || 'your account'}. Original gifts keep their own
                links. Repeating this file continues an interrupted restore and reuses copies already saved.
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy || blocked || sessionError || preview.backup.entries.length === 0}
                  onClick={async () => {
                    const controller = start('restoring')
                    try {
                      await restoreGardenBackup(
                        user.id,
                        preview.backup,
                        preview.fileHash,
                        controller.signal,
                        (value) => {
                          if (current(controller)) setMessage(value)
                        },
                      )
                      if (!current(controller)) return
                      setMessage(
                        `Kept ${count(preview.backup.entries.length, 'restored copy', 'restored copies')}. Your original links still work.`,
                      )
                      setPreview(null)
                      onRestored?.()
                    } catch (e) {
                      failed(controller, e)
                    } finally {
                      finish(controller)
                    }
                  }}
                >
                  Restore copies
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPreview(null)
                    setMessage('')
                    setError(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </div>
        {busy && (
          <button
            type="button"
            className={styles.link}
            onClick={() => {
              active.current?.abort()
              active.current = null
              setPhase('ready')
              setMessage(
                phase === 'restoring'
                  ? 'Stopped. Copies already kept stay in your library; use the same file to continue.'
                  : 'Stopped. No backup was downloaded.',
              )
            }}
          >
            Stop for now
          </button>
        )}
        {message && (
          <p className={styles.notice} role="status">
            {message}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error} {preview && 'Retry this file to finish; copies already kept will be reused.'}
          </p>
        )}
      </div>
    </details>
  )
}
