import { expect, test, type Page } from '@playwright/test'

const flower = {
  name: 'Cosmos',
  meaning: 'For the company.',
  petalColors: ['#d993aa', '#e6b7c5', '#f3d5de'],
  centerColor: '#d9aa52',
  stemColor: '#607d56',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 88,
}

async function openJournal(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() =>
    localStorage.setItem(
      'bloomnote.flower-journal.v1',
      JSON.stringify([
        {
          id: 'AbCdEf:0',
          gardenId: 'AbCdEf',
          flowerIndex: 0,
          flowerName: 'Cosmos',
          meaning: 'For the company.',
          colors: ['#d993aa'],
          memory: 'Soup and company.',
          savedAt: '2026-11-01T12:00:00Z',
        },
      ]),
    ),
  )
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: { user: null } })
    if (path === '/api/garden')
      return route.fulfill({
        json: { garden: { from: 'Alex', to: 'Sam', message: 'Thanks.', flowers: [flower] } },
      })
    if (path.endsWith('/response')) return route.fulfill({ json: { waters: 0, feelings: {} } })
    return route.fulfill({ status: 204 })
  })
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: /open the garden/i }).click()
  await page.getByText('keep this garden', { exact: true }).click()
  return page.getByRole('region', { name: 'my flower journal', exact: true })
}

test('a refused journal write keeps the draft and offers a retry', async ({ page }) => {
  const journal = await openJournal(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'bloomnote.flower-journal.v1') throw new DOMException('Full', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  await journal.getByRole('button', { name: /say what it means to you/ }).click()
  const draft = journal.getByRole('textbox', { name: 'What Cosmos means to you' })
  await draft.fill('The afternoon we stayed in.')
  await journal.getByRole('button', { name: 'keep', exact: true }).click()
  await expect(draft).toHaveValue('The afternoon we stayed in.')
  await expect(journal.getByRole('alert')).toContainText('could not save')
})

test('closing the keepsake stops a recording even if microphone permission arrives late', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const state = { stopped: 0, release: () => {} }
    Object.assign(window, { recordingProbe: state })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: () =>
          new Promise((resolve) => {
            state.release = () => resolve({ getTracks: () => [{ stop: () => state.stopped++ }] })
          }),
      },
    })
    class Recorder extends EventTarget {
      static isTypeSupported() {
        return true
      }
      state = 'inactive'
      start() {
        this.state = 'recording'
      }
      stop() {
        this.state = 'inactive'
        this.dispatchEvent(new Event('stop'))
      }
    }
    Object.assign(window, { MediaRecorder: Recorder })
  })
  const journal = await openJournal(page)
  await journal.getByRole('button', { name: 'say it out loud instead', exact: true }).click()
  await page.getByText('keep this garden', { exact: true }).click()
  await page.evaluate(() =>
    (window as unknown as { recordingProbe: { release: () => void } }).recordingProbe.release(),
  )
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { recordingProbe: { stopped: number } }).recordingProbe.stopped,
      ),
    )
    .toBe(1)
})

test('a kept voice memory has a playable source with reduced motion', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { voicePaused: false })
    HTMLMediaElement.prototype.play = function () {
      this.dispatchEvent(new Event('play'))
      return Promise.resolve()
    }
    HTMLMediaElement.prototype.pause = function () {
      Object.assign(window, { voicePaused: true })
      this.dispatchEvent(new Event('pause'))
    }
  })
  const journal = await openJournal(page)
  await page.evaluate(async () => {
    const path = '/src/lib/voiceMemory.ts'
    const { saveVoiceMemory } = await import(path)
    if (
      !(await saveVoiceMemory({
        entryId: 'AbCdEf:0',
        blob: new Blob(['synthetic audio'], { type: 'audio/webm' }),
        seconds: 2,
        savedAt: new Date().toISOString(),
      }))
    )
      throw new Error('fixture save failed')
  })
  await page.reload()
  await page.getByRole('button', { name: /open the garden/i }).click()
  await page.getByText('keep this garden', { exact: true }).click()
  await journal.getByRole('button', { name: 'a voice memory is kept here' }).click()
  await expect(journal.locator('audio')).toHaveAttribute('src', /^blob:/)
  await journal.getByRole('button', { name: 'Play this voice memory', exact: true }).click()
  await expect(journal.getByRole('button', { name: 'Pause this voice memory', exact: true })).toBeVisible()
  await page.getByText('keep this garden', { exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { voicePaused: boolean }).voicePaused))
    .toBe(true)
})

test('flower share and export failures give a usable next step', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
    HTMLCanvasElement.prototype.getContext = () => null
  })
  await openJournal(page)
  await page.getByRole('button', { name: /^Cosmos:/ }).click()
  const panel = page.locator('#flower-peek')
  await panel.getByRole('button', { name: 'share this flower', exact: true }).click()
  await expect(panel.getByRole('alert')).toContainText('couldn’t share')
  await expect(panel.getByRole('textbox', { name: 'Flower meaning to copy' })).toHaveValue(
    'Cosmos: For the company.',
  )
  await panel.getByRole('button', { name: 'save a pressed-flower card' }).click()
  await expect(panel.getByRole('alert')).toContainText('couldn’t make the card')
})
