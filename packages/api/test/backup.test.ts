import { SELF, env } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sampleEntry } from '../../../shared/backup.fixture'
import { exportBackupPage, restoreBackupEntry } from '../src/backup'
import { readGarden, recordReceived } from '../src/gardens'
import type { Env } from '../src/env'

const fileHash = 'a'.repeat(64)
const AUTH = new URL(env.AUTH_URL).origin
function session(id: string | null = 'owner', status = 200) {
  vi.stubGlobal('fetch', async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    if (url.origin !== AUTH) throw new Error('Unexpected external call')
    return new Response(
      JSON.stringify({ user: id ? { id, email: 'test@example.test', displayName: 'Test' } : null }),
      { status, headers: { 'content-type': 'application/json' } },
    )
  })
}
const headers = {
  cookie: 'session=local-test',
  'X-Bloomnote-Account': 'owner',
  'content-type': 'application/json',
}
const restore = (entry: unknown = sampleEntry(), extra: Record<string, unknown> = {}) =>
  SELF.fetch('https://x/api/backup/restore', {
    method: 'POST',
    headers,
    body: JSON.stringify({ version: 1, fileHash, entry, ...extra }),
  })
beforeEach(() => session())
afterEach(() => vi.unstubAllGlobals())

describe('account backup boundaries', () => {
  it('requires a confirmed matching account before any write', async () => {
    const noSession = await SELF.fetch('https://x/api/backup/export')
    expect(noSession.status).toBe(401)
    session('other')
    expect((await restore()).status).toBe(409)
    session('owner', 503)
    expect((await restore()).status).toBe(503)
    expect((await env.GARDENS.list()).keys).toHaveLength(0)
  })
  it('validates version, fingerprint, content and body size without writing', async () => {
    expect((await restore(sampleEntry(), { version: 2 })).status).toBe(400)
    expect((await restore(sampleEntry(), { fileHash: 'wrong' })).status).toBe(400)
    expect((await restore({ ...sampleEntry(), garden: {} })).status).toBe(400)
    expect((await restore({ ...sampleEntry(), unknown: 'x'.repeat(33 * 1024) })).status).toBe(413)
    expect((await env.GARDENS.list()).keys).toHaveLength(0)
  })
  it('paginates all legacy and modern account entries without reading another library', async () => {
    const entry = sampleEntry()
    for (let i = 0; i < 14; i++) {
      const id = `test${String(i).padStart(2, '0')}`
      const summary = { id, from: 'Alex', to: 'Sam', createdAt: entry.createdAt, swatches: ['#d1477a'] }
      await env.GARDENS.put(`g:${id}`, JSON.stringify({ ...entry.garden, ownerId: 'private-owner' }))
      await env.GARDENS.put(`sent:owner:${id}`, JSON.stringify(summary), i % 2 ? { metadata: summary } : {})
    }
    await env.GARDENS.put('sent:other:AbCdEf', JSON.stringify({ id: 'AbCdEf' }))
    const entries = []
    let cursor: string | undefined
    do {
      const page = await exportBackupPage(env, 'owner', cursor)
      entries.push(...page.entries)
      cursor = page.next ?? undefined
    } while (cursor)
    expect(entries).toHaveLength(14)
    expect(new Set(entries.map((e) => e.id)).size).toBe(14)
    expect(entries.every((e) => e.garden.secret === entry.garden.secret)).toBe(true)
    expect(JSON.stringify(entries)).not.toContain('private-owner')
    const bad = await SELF.fetch('https://x/api/backup/export?cursor=broken', { headers })
    expect(bad.status).toBe(400)
    const good = await SELF.fetch('https://x/api/backup/export', { headers })
    expect(good.headers.get('cache-control')).toContain('no-store')
  })
  it('fails the export explicitly if one library garden is missing', async () => {
    await env.GARDENS.put('sent:owner:AbCdEf', JSON.stringify({ createdAt: '2026-10-10' }))
    const res = await SELF.fetch('https://x/api/backup/export', { headers })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: expect.stringContaining('Nothing was downloaded') })
  })
})

describe('copy restoration', () => {
  it('keeps original links and ownership, labels copies and preserves both classifications and content', async () => {
    const entry = sampleEntry()
    await env.GARDENS.put(`g:${entry.id}`, JSON.stringify({ ...entry.garden, ownerId: 'original-owner' }))
    const original = await env.GARDENS.get(`g:${entry.id}`)
    const response = await restore()
    expect(response.status).toBe(200)
    const { id } = await response.json<{ id: string }>()
    expect(id).toMatch(/^[A-Za-z0-9]{12}$/)
    expect(id).not.toBe(entry.id)
    expect(await env.GARDENS.get(`g:${entry.id}`)).toBe(original)
    const raw = await env.GARDENS.get<Record<string, unknown>>(`g:${id}`, 'json')
    expect(raw).toMatchObject({ ...entry.garden, ownerId: 'owner' })
    expect(raw).not.toHaveProperty('voice')
    expect(await readGarden(env, id)).not.toHaveProperty('restoreFingerprint')
    const sent = await env.GARDENS.get<Record<string, unknown>>(`sent:owner:${id}`, 'json')
    const received = await env.GARDENS.get<Record<string, unknown>>(`recv:owner:${id}`, 'json')
    expect(sent).toMatchObject({ restored: true, createdAt: entry.createdAt })
    expect(received).toMatchObject({ restored: true, receivedAt: entry.receivedAt })
    expect(await env.GARDENS.get(`water:${id}`, 'json')).toEqual(entry.response)
    expect(await recordReceived(env, 'owner', id)).toBe(false)
  })
  it('reuses a copy after lost replies and preserves newer responses', async () => {
    const first = await restoreBackupEntry(env, 'owner', fileHash, sampleEntry())
    await env.GARDENS.put(`water:${first.id}`, JSON.stringify({ waters: 8, feelings: { hug: 5 } }))
    const again = await restoreBackupEntry(env, 'owner', fileHash, sampleEntry())
    expect(again).toEqual(first)
    expect((await env.GARDENS.list({ prefix: 'g:' })).keys).toHaveLength(1)
    expect(await env.GARDENS.get(`water:${first.id}`, 'json')).toEqual({ waters: 8, feelings: { hug: 5 } })
    const otherAccount = await restoreBackupEntry(env, 'other', fileHash, sampleEntry())
    expect(otherAccount.id).not.toBe(first.id)
  })
  it('repairs a partial KV write when the same file is retried', async () => {
    let fail = true
    const storage = new Proxy(env.GARDENS, {
      get(target, key) {
        if (key === 'put')
          return async (name: string, value: string, options?: KVNamespacePutOptions) => {
            if (fail && name.startsWith('sent:')) {
              fail = false
              throw new Error('Synthetic storage failure')
            }
            return target.put(name, value, options)
          }
        const value = Reflect.get(target, key)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const local = { ...env, GARDENS: storage } as Env
    await expect(restoreBackupEntry(local, 'owner', fileHash, sampleEntry())).rejects.toThrow('Synthetic')
    expect((await env.GARDENS.list({ prefix: 'g:' })).keys).toHaveLength(1)
    const result = await restoreBackupEntry(local, 'owner', fileHash, sampleEntry())
    expect((await env.GARDENS.list({ prefix: 'g:' })).keys).toHaveLength(1)
    expect(await env.GARDENS.get(`sent:owner:${result.id}`)).not.toBeNull()
    expect(await env.GARDENS.get(`recv:owner:${result.id}`)).not.toBeNull()
  })
  it('fails closed when the daily restore budget is unavailable or exhausted', async () => {
    for (const bump of [
      async () => ({ ok: false, retryAfter: 60 }),
      async () => {
        throw new Error('Counter unavailable')
      },
    ]) {
      const local = {
        ...env,
        COUNTERS: { idFromName: () => 'local', get: () => ({ bump }) },
      } as unknown as Env
      await expect(restoreBackupEntry(local, 'owner', fileHash, sampleEntry())).rejects.toThrow()
      expect((await env.GARDENS.list()).keys).toHaveLength(0)
    }
  })
  it('refuses an occupied identifier without changing the existing garden', async () => {
    const result = await restoreBackupEntry(env, 'owner', fileHash, sampleEntry())
    const unrelated = JSON.stringify({ ...sampleEntry().garden, ownerId: 'different-owner' })
    await env.GARDENS.put(`g:${result.id}`, unrelated)
    await expect(restoreBackupEntry(env, 'owner', fileHash, sampleEntry())).rejects.toThrow('already in use')
    expect(await env.GARDENS.get(`g:${result.id}`)).toBe(unrelated)
  })
})
