import { readFile, mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { sampleEntry } from '../../../shared/backup.fixture'

const user = { id: 'backup-check', displayName: 'Alex', email: 'backup@example.test' }
const newId = 'abcdefABCDEF'
for (const width of [390, 1440]) {
  test(`a full backup previews and resumes as fresh copies at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const entry = sampleEntry()
    const kept = {
      flowerIndex: 0,
      memory: 'The rainy afternoon.',
      mine: 'A fresh start.',
      shelves: ['remember'],
      savedAt: '2026-11-02T12:00:00Z',
    }
    const summary = {
      id: entry.id,
      from: entry.garden.from,
      to: entry.garden.to,
      createdAt: entry.createdAt,
      swatches: ['#d1477a'],
    }
    let writes = 0,
      copySaved = false
    const payloads: unknown[] = []
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url())
      if (url.pathname === '/api/me') return route.fulfill({ json: { user } })
      if (url.pathname === '/api/mine')
        return route.fulfill({
          json: {
            sent: copySaved ? [summary, { ...summary, id: newId, restored: true }] : [summary],
            received: [],
          },
        })
      if (url.pathname === '/api/backup/export') {
        expect(route.request().headers()['x-bloomnote-account']).toBe(user.id)
        const { voice: _voice, ...serverEntry } = entry
        return route.fulfill({
          json: {
            entries: [
              {
                ...serverEntry,
                pinned: false,
                libraries: url.searchParams.has('cursor') ? ['received'] : ['sent'],
              },
            ],
            next: url.searchParams.has('cursor') ? null : 'received-page',
          },
        })
      }
      if (url.pathname === '/api/backup/restore') {
        expect(route.request().headers()['x-bloomnote-account']).toBe(user.id)
        payloads.push(route.request().postDataJSON())
        writes++
        copySaved = true
        // Simulate a committed copy whose response never reaches the browser.
        if (writes === 1) return route.abort('failed')
        return route.fulfill({ json: { id: newId } })
      }
      if (url.pathname === '/api/garden') return route.fulfill({ json: { garden: entry.garden } })
      if (url.pathname.endsWith('/response')) return route.fulfill({ json: entry.response })
      return route.fulfill({ json: { responses: {} } })
    })
    await page.goto('/mine')
    await expect(page.getByRole('link', { name: /^for Sam/ })).toBeVisible()
    await page.evaluate(
      async ({ id, voice }) => {
        localStorage.setItem('bloomnote:pinned-gardens', JSON.stringify([id]))
        localStorage.setItem('bloomnote.watered.v1', JSON.stringify([id]))
        const module = '/src/lib/voiceMemory.ts'
        const { saveVoiceMemory } = await import(module)
        const saved = await saveVoiceMemory({
          entryId: id,
          blob: new Blob([Uint8Array.from(atob(voice.base64), (c) => c.charCodeAt(0))], { type: voice.type }),
          seconds: voice.seconds,
          savedAt: voice.savedAt,
        })
        if (!saved) throw new Error('The browser could not keep a synthetic voice memory')
      },
      { id: entry.id, voice: entry.voice! },
    )
    await page.evaluate(
      async ({ id, voice, kept }) => {
        const module = '/src/lib/voiceMemory.ts'
        const { saveVoiceMemory } = await import(module)
        const bytes = Uint8Array.from(atob(voice.base64), (c) => c.charCodeAt(0))
        if (
          !(await saveVoiceMemory({
            entryId: `${id}:0`,
            blob: new Blob([bytes], { type: voice.type }),
            seconds: voice.seconds,
            savedAt: voice.savedAt,
          }))
        )
          throw new Error('The journal voice fixture could not be saved')
        localStorage.setItem(
          'bloomnote.flower-journal.v1',
          JSON.stringify([
            {
              ...kept,
              id: `${id}:0`,
              gardenId: id,
              flowerName: 'Dahlia',
              meaning: 'A little joy',
              colors: ['#d1477a'],
            },
          ]),
        )
      },
      { id: entry.id, voice: entry.voice!, kept },
    )
    await page.getByText('backup & restore', { exact: true }).click()
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click()
    const download = await downloaded
    const path = testInfo.outputPath('garden-backup.json')
    await download.saveAs(path)
    const bytes = await readFile(path)
    const file = JSON.parse(bytes.toString())
    expect(file.entries).toHaveLength(1)
    expect(file.entries[0].garden).toEqual(entry.garden)
    expect(file.entries[0].voice).toEqual(entry.voice)
    expect(file.entries[0].journal).toEqual([{ ...kept, voice: entry.voice }])
    expect(file.entries[0].libraries).toEqual(['sent', 'received'])
    expect(file.entries[0].pinned).toBe(true)
    expect(bytes.toString()).not.toMatch(/ownerId|restoreFingerprint|backup-check/)
    const picker = page.getByLabel('Choose a JSON backup')
    await picker.setInputFiles({
      name: 'future.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ ...file, version: 99 })),
    })
    await expect(page.getByRole('alert')).toContainText('version is not supported')
    expect(writes).toBe(0)
    await picker.setInputFiles(path)
    await expect(page.getByRole('region', { name: 'Backup preview' })).toBeVisible()
    expect(writes).toBe(0)
    if (process.env.BLOOMNOTE_BACKUP_QA) {
      await mkdir(process.env.BLOOMNOTE_BACKUP_QA, { recursive: true })
      await page.screenshot({
        path: `${process.env.BLOOMNOTE_BACKUP_QA}/backup-${width}-${testInfo.project.name}.png`,
        fullPage: true,
      })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(writes).toBe(0)
    await picker.setInputFiles(path)
    await page.getByRole('button', { name: 'Restore copies', exact: true }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await page.getByRole('button', { name: 'Restore copies', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Kept 1 restored copy' })).toBeVisible()
    expect(writes).toBe(2)
    expect(payloads[0]).toEqual(payloads[1])
    expect(payloads[0]).not.toHaveProperty('entry.voice')
    expect(payloads[0]).not.toHaveProperty('entry.journal')
    await expect(page.getByText('restored copy', { exact: true })).toBeVisible()
    const memory = await page.evaluate(async (id) => {
      const module = '/src/lib/voiceMemory.ts'
      const { loadVoiceMemory } = await import(module)
      const item = await loadVoiceMemory(id)
      return {
        bytes: [...new Uint8Array(await item.blob.arrayBuffer())],
        seconds: item.seconds,
        savedAt: item.savedAt,
        pinned: JSON.parse(localStorage.getItem('bloomnote:pinned-gardens') || '[]').includes(id),
      }
    }, newId)
    expect(memory).toEqual({
      bytes: [0, 1, 2, 3, 255],
      seconds: 2,
      savedAt: entry.voice!.savedAt,
      pinned: true,
    })
    const journalCopy = await page.evaluate(async (id) => {
      const module = '/src/lib/voiceMemory.ts'
      const { loadVoiceMemory } = await import(module)
      const voice = await loadVoiceMemory(`${id}:0`)
      const journal = JSON.parse(localStorage.getItem('bloomnote.flower-journal.v1') || '[]').find(
        (item: { id: string }) => item.id === `${id}:0`,
      )
      return { journal, bytes: voice ? [...new Uint8Array(await voice.blob.arrayBuffer())] : null }
    }, newId)
    expect(journalCopy).toMatchObject({
      journal: { ...kept, id: `${newId}:0`, gardenId: newId },
      bytes: [0, 1, 2, 3, 255],
    })
    await page.locator(`a[href="/g/${newId}"]`).first().click()
    await page.getByRole('button', { name: 'open the garden', exact: true }).click()
    // The reply trail repeats the current note; check its main reveal as well as the new link.
    await expect(page.getByText(entry.garden.message, { exact: true }).first()).toBeVisible()
    await page.getByText('keep this garden', { exact: true }).click()
    const restoredFlower = page
      .getByRole('region', { name: 'my flower journal', exact: true })
      .locator('li')
      .filter({ has: page.locator(`a[href="/g/${newId}"]`) })
    await expect(restoredFlower).toContainText(kept.memory)
    await expect(restoredFlower.getByRole('button', { name: kept.mine, exact: true })).toBeVisible()
    await restoredFlower.getByRole('button', { name: 'a voice memory is kept here', exact: true }).click()
    await expect(restoredFlower.locator('audio')).toHaveAttribute('src', /^blob:/)
    if (process.env.BLOOMNOTE_BACKUP_QA)
      await page.screenshot({
        path: `${process.env.BLOOMNOTE_BACKUP_QA}/journal-restore-${width}-${testInfo.project.name}.png`,
        fullPage: true,
      })
  })
}

test('a missing account session cannot silently export a device-only backup', async ({ page }) => {
  await page.route('**/api/**', (route) => {
    if (new URL(route.request().url()).pathname === '/api/me')
      return route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } })
    return route.fulfill({ json: { responses: {} } })
  })
  await page.goto('/mine')
  await page.getByText('backup & restore', { exact: true }).click()
  await expect(page.getByRole('button', { name: 'Download JSON backup', exact: true })).toBeDisabled()
  await expect(
    page.getByText('Sign-in could not be checked. Retry it before backing up or restoring.'),
  ).toBeVisible()
})

test('blocked device storage cannot produce a misleading empty backup', async ({ page }) => {
  await page.route('**/api/**', (route) => route.fulfill({ json: { user: null, responses: {} } }))
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem
    Storage.prototype.getItem = function (key) {
      if (key === 'bloomnote:mine') throw new DOMException('Storage denied', 'SecurityError')
      return get.call(this, key)
    }
  })
  let downloads = 0
  page.on('download', () => downloads++)
  await page.goto('/mine')
  await page.getByText('backup & restore', { exact: true }).click()
  await page.getByRole('button', { name: 'Download JSON backup', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Could not read this device’s library')
  expect(downloads).toBe(0)
})
