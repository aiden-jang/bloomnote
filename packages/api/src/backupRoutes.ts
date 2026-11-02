import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { resolveSession } from '@aidenjang/auth-client'
import { BackupError } from '../../../shared/backup.js'
import { exportBackupPage, restoreBackupEntry, RestoreConflict } from './backup.js'
import type { Env } from './env.js'
import { checkRate, clientIp } from './rateLimit.js'

export const backupRoutes = new Hono<{ Bindings: Env; Variables: { backupUser: string } }>()

backupRoutes.use('/api/backup/*', async (c, next) => {
  const session = await resolveSession(c.req.raw, c.env.AUTH_URL)
  if (session.state === 'unavailable')
    return c.json({ error: 'Sign-in could not be checked. Try again.' }, 503)
  if (session.state !== 'signed-in')
    return c.json({ error: 'Sign in to back up or restore your account gardens.' }, 401)
  if (c.req.header('X-Bloomnote-Account') !== session.user.id)
    return c.json({ error: 'Your account changed. Reload before continuing.' }, 409)
  c.set('backupUser', session.user.id)
  // A full file plus one interrupted retry must fit; the atomic daily copy budget bounds writes.
  const limited = await checkRate(c.env, 'backup', clientIp(c.req.raw.headers), 480)
  if (!limited.ok)
    return c.json({ error: limited.message }, 429, { 'Retry-After': String(limited.retryAfter) })
  await next()
})
backupRoutes.get('/api/backup/export', async (c) => {
  try {
    return c.json(await exportBackupPage(c.env, c.get('backupUser'), c.req.query('cursor')))
  } catch (e) {
    return c.json(
      {
        error:
          e instanceof BackupError
            ? e.message
            : 'Could not read every garden. Nothing was downloaded; try again.',
      },
      e instanceof BackupError ? 400 : 503,
    )
  }
})
backupRoutes.post(
  '/api/backup/restore',
  bodyLimit({
    maxSize: 32 * 1024,
    onError: (c) => c.json({ error: 'This garden is too large to restore.' }, 413),
  }),
  async (c) => {
    const body = await c.req
      .json<{ version?: unknown; fileHash?: unknown; entry?: unknown }>()
      .catch(() => null)
    if (!body || body.version !== 1 || typeof body.fileHash !== 'string')
      return c.json({ error: 'Choose a supported Bloomnote backup.' }, 400)
    try {
      return c.json(await restoreBackupEntry(c.env, c.get('backupUser'), body.fileHash, body.entry))
    } catch (e) {
      if (e instanceof BackupError) return c.json({ error: e.message }, 400)
      if (e instanceof RestoreConflict) return c.json({ error: e.message }, 409)
      return c.json({ error: 'Could not finish this copy. Retry the same file to continue safely.' }, 503)
    }
  },
)
