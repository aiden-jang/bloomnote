import { expect, test, type Page } from '@playwright/test'

const flowers = ['Dahlia', 'Cosmos', 'Sunflower'].map((name) => ({
  name,
  meaning: 'For showing up with soup.',
  petalColors: ['#d993aa', '#e6b7c5', '#f3d5de'],
  centerColor: '#d9aa52',
  stemColor: '#607d56',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 88,
}))
const garden = { from: 'Alex', to: 'Sam', message: 'Thanks for the soup and the company.', flowers }

async function mockApp(page: Page) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: { user: null } })
    if (path === '/api/design-garden')
      return route.fulfill({
        headers: { 'content-type': 'text/event-stream' },
        body: `event: complete\ndata: ${JSON.stringify({ garden: { flowers, bouquet_note: 'For the company.' } })}\n\n`,
      })
    if (path === '/api/garden' && route.request().method() === 'POST')
      return route.fulfill({ json: { id: 'AbCdEf' } })
    if (path === '/api/garden') return route.fulfill({ json: { garden } })
    if (path.endsWith('/response')) return route.fulfill({ json: { waters: 0, feelings: {} } })
    return route.fulfill({ status: 204 })
  })
}

async function grow(page: Page) {
  await page.goto('/')
  await page.getByLabel('your note', { exact: true }).fill(garden.message)
  await page.getByLabel('to', { exact: true }).fill('Sam')
  await page.getByRole('button', { name: 'grow their garden', exact: true }).click()
  await expect(page.getByRole('button', { name: 'copy link', exact: true })).toBeVisible()
}

test('an unavailable archive offers retry instead of claiming it is empty', async ({ page }) => {
  let available = false
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { user: { id: 'preview', displayName: 'Alex', email: 'preview@example.test' } } }),
  )
  await page.route('**/api/mine', (route) =>
    available
      ? route.fulfill({
          json: {
            sent: [{ ...garden, id: 'AbCdEf', createdAt: '2026-10-14T12:00:00Z', swatches: ['#d993aa'] }],
            received: [],
          },
        })
      : route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } }),
  )
  await page.goto('/mine')
  await expect(page.getByRole('alert')).toContainText(/couldn.t load your gardens/i)
  await expect(page.getByText('you haven’t grown any yet.', { exact: true })).toHaveCount(0)
  available = true
  await page.getByRole('button', { name: 'try again', exact: true }).click()
  await expect(page.getByRole('listitem')).toContainText('Sam')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('copy failures explain how to send the visible link and allow retry', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockApp(page)
  await page.addInitScript(() => {
    let attempt = 0
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: async () => {
          if (attempt++ === 0) throw new DOMException('Blocked', 'NotAllowedError')
        },
      },
    })
  })
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await grow(page)
  await expect(page.getByText('Nothing has been sent.', { exact: false })).toBeVisible()
  {
    for (const [name, width, height] of [
      ['desktop', 1440, 900],
      ['mobile', 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height })
      await page.getByText('Nothing has been sent.', { exact: false }).scrollIntoViewIfNeeded()
      await page.screenshot({
        path: test.info().outputPath(`sharing-${name}.png`),
        fullPage: false,
        animations: 'disabled',
      })
    }
  }
  await page.getByRole('button', { name: 'copy link', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/select.*link/i)
  await expect(page.getByRole('button', { name: 'copied', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'copy link', exact: true }).click()
  await expect(page.getByRole('button', { name: 'copied', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('recipient actions stay unreachable until the animated reveal finishes', async ({
  page,
  browserName,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await mockApp(page)
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  const share = page.getByRole('button', { name: 'share this garden', exact: true, includeHidden: true })
  await expect(share).toBeHidden()
  await expect(share).toBeVisible()
  for (let step = 0; step < 5; step++) {
    await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
    await expect(page.locator(':focus')).toBeVisible()
  }
})

test('account collection tabs support arrow and Home/End navigation', async ({ page }) => {
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { user: { id: 'preview', displayName: 'Alex', email: 'preview@example.test' } } }),
  )
  await page.route('**/api/mine', (route) => route.fulfill({ json: { sent: [], received: [] } }))
  await page.goto('/mine')
  const sent = page.getByRole('tab', { name: 'sent', exact: true })
  const received = page.getByRole('tab', { name: 'received', exact: true })
  await sent.press('ArrowRight')
  await expect(received).toBeFocused()
  await expect(received).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('tabpanel')).toHaveAccessibleName('received')
  await received.press('Home')
  await expect(sent).toBeFocused()
  await sent.press('End')
  await expect(received).toBeFocused()
})

test('a failed feeling can be retried without claiming it was sent', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockApp(page)
  let attempts = 0
  await page.route('**/api/garden/AbCdEf/feeling', (route) =>
    attempts++ === 0
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: { waters: 1, feelings: { love: 1 } } }),
  )
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  await page.getByRole('button', { name: 'water it', exact: true }).click()
  await page.getByRole('button', { name: 'love', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/couldn.t send/i)
  await expect(page.getByText('sent back a little love', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'love', exact: true }).click()
  await expect(page.getByText('sent back a little love', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a schedule that passes during generation is described as opening now', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.setFixedTime(new Date('2026-10-14T12:00:00Z'))
  await mockApp(page)
  await page.route('**/api/design-garden', async (route) => {
    await page.clock.setFixedTime(new Date('2026-10-16T12:00:00Z'))
    await route.fulfill({
      headers: { 'content-type': 'text/event-stream' },
      body: `event: complete\ndata: ${JSON.stringify({ garden: { flowers, bouquet_note: 'For the company.' } })}\n\n`,
    })
  })
  let stored: Record<string, unknown> | null = null
  await page.route('**/api/garden', (route) => {
    stored = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ json: { id: 'AbCdEf' } })
  })
  await page.goto('/')
  await page.getByLabel('your note', { exact: true }).fill(garden.message)
  await page.getByLabel('to', { exact: true }).fill('Sam')
  await page.getByRole('button', { name: /schedule for later/ }).click()
  await page.getByRole('button', { name: 'tomorrow', exact: true }).click()
  await page.getByRole('button', { name: 'grow their garden', exact: true }).click()
  await expect(page.getByText("Sam's garden is ready", { exact: true })).toBeVisible()
  expect(stored).not.toBeNull()
  expect(stored).not.toHaveProperty('unlockAt')
  await expect(page.getByRole('alert')).toContainText(/opens now/i)
})

test('larger note text preserves the message and remembers the reading choice', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockApp(page)
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  const control = page.getByRole('button', { name: 'Larger text', exact: true })
  await expect(control).toBeVisible()
  const note = page.getByText(garden.message, { exact: true })
  const before = await note.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))
  await control.click()
  await expect(control).toHaveAttribute('aria-pressed', 'true')
  expect(await note.evaluate((node) => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThan(before)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    await note.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: test.info().outputPath(`refinement-reading-${width}.png`),
      animations: 'disabled',
    })
  }
  await page.reload()
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  await expect(control).toHaveAttribute('aria-pressed', 'true')
  await expect(note).toHaveText(garden.message)
})

test('garden downloads keep unicode names and calendar reminders have descriptive filenames', async ({
  page,
  browserName,
}) => {
  await mockApp(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: () => false, configurable: true })
  })
  await page.route('**/api/garden?*', (route) =>
    route.fulfill({ json: { garden: { ...garden, to: '수진' } } }),
  )
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  await page.getByText('keep this garden', { exact: true }).click()
  const save = page.getByRole('button', { name: /^(save it as an image|download started)$/ })
  const imageWait = page.waitForEvent('download')
  await save.click()
  const image = await imageWait
  expect(image.suggestedFilename().normalize('NFC')).toMatch(/^bloomnote-수진-\d{4}-\d{2}-\d{2}T.+Z\.png$/)
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 })
    for (const forcedColors of ['none', 'active'] as const) {
      await page.emulateMedia({ forcedColors })
      const copy = page.getByRole('button', { name: 'copy the note', exact: true })
      await copy.focus()
      await page.keyboard.press(browserName === 'webkit' ? 'Alt+Tab' : 'Tab')
      await page.keyboard.press(browserName === 'webkit' ? 'Alt+Shift+Tab' : 'Shift+Tab')
      await expect(copy).toBeFocused()
      if (forcedColors === 'active') await expect(copy).not.toHaveCSS('outline-style', 'none')
      await page.screenshot({
        path: test.info().outputPath(`details2-garden-${width}-${forcedColors}.png`),
        animations: 'disabled',
      })
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  await page.route('**/api/garden?*', (route) =>
    route.fulfill({ json: { garden: { ...garden, to: '수진', unlockAt: '2099-06-01T12:00:00.000Z' } } }),
  )
  await page.reload()
  await page.getByText('add a reminder', { exact: true }).click()
  const calendarWait = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Apple Calendar / other', exact: false }).click()
  const calendar = await calendarWait
  expect(calendar.suggestedFilename().normalize('NFC')).toMatch(
    /^bloomnote-garden-opening-수진-\d{4}-.*Z\.ics$/,
  )
})

test('recipient sharing can be cancelled and has a selectable link when sharing fails', async ({ page }) => {
  await mockApp(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async () => {
        throw new DOMException('Dismissed', 'AbortError')
      },
    })
  })
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  const share = page.getByRole('button', { name: 'share this garden', exact: true })
  await share.click()
  await expect(share).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByText(garden.message, { exact: true })).toBeVisible()
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException('Denied', 'NotAllowedError')
        },
      },
    })
  })
  await share.click()
  const link = page.getByRole('textbox', { name: 'Garden link', exact: true })
  await expect(link).toHaveValue(page.url())
  await expect(link).toHaveAttribute('readonly', '')
  await expect(share).toBeFocused()
  await link.focus()
  expect(await link.evaluate((node: HTMLInputElement) => node.selectionEnd! - node.selectionStart!)).toBe(
    page.url().length,
  )
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await link.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`share-fallback-${width}.png`),
      animations: 'disabled',
    })
  }
})

test('a sealed garden opens immediately after returning from sleep', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await mockApp(page)
  const initial = new Date('2026-10-16T12:00:00Z')
  await page.clock.setFixedTime(initial)
  await page.route('**/api/garden?*', (route) =>
    route.fulfill({
      json: {
        garden: { ...garden, unlockAt: '2026-10-19T12:00:00Z' },
      },
    }),
  )
  await page.goto('/g/AbCdEf')
  await expect(page.getByText('3d 0h', { exact: true })).toBeVisible()
  await page.getByText('add a reminder', { exact: false }).click()
  await expect(page.getByRole('link', { name: 'Google Calendar', exact: true })).toHaveAccessibleDescription(
    'Opens in a new tab',
  )
  await page.clock.setFixedTime(new Date('2026-10-19T12:00:01Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.getByRole('button', { name: 'open the garden', exact: true })).toBeVisible()
})

test('note animation keeps whole emoji and printing includes the complete note', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await mockApp(page)
  const note = '👩🏽‍💻 café A small thank you. '.repeat(18)
  await page.route('**/api/garden?*', (route) =>
    route.fulfill({
      json: {
        garden: { ...garden, bouquetNote: note },
      },
    }),
  )
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  const label = page.locator('p').filter({ hasText: /why this garden/ })
  await expect(label).toHaveCount(1)
  const stream = label.locator('..').locator('p').last().locator('span[aria-hidden]').first()
  await expect(stream).toBeAttached()
  const prefixes = await stream.evaluate(async (span, text) => {
    const parts = Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text),
      (s) => s.segment,
    )
    const allowed = new Set(parts.map((_, i) => parts.slice(0, i + 1).join('')))
    return new Promise<{ valid: boolean; seen: number }>((resolve) => {
      let valid = true
      let seen = 0
      const observer = new MutationObserver(() => {
        const value = span.textContent!
        if (value) {
          seen++
          if (!allowed.has(value)) valid = false
        }
      })
      observer.observe(span, { childList: true, characterData: true, subtree: true })
      setTimeout(() => {
        observer.disconnect()
        resolve({ valid, seen })
      }, 4500)
    })
  }, note)
  expect(prefixes.valid).toBe(true)
  expect(prefixes.seen).toBeGreaterThan(0)
  await expect(stream).toBeVisible()
  await page.emulateMedia({ media: 'print' })
  const full = page.getByText(note, { exact: true }).last()
  await expect(full).toBeVisible()
  expect(await full.evaluate((node) => getComputedStyle(node).position)).toBe('static')
  await expect(stream).toBeHidden()
  const flowersOnPaper = page.locator('button[aria-controls="flower-peek"]')
  await expect(flowersOnPaper).toHaveCount(3)
  for (const flower of await flowersOnPaper.all()) {
    await expect(flower).toBeVisible()
    expect(await flower.locator('svg path').count()).toBeGreaterThan(0)
    expect(await flower.evaluate((node) => getComputedStyle(node).transform)).not.toBe('none')
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await page.screenshot({
      path: test.info().outputPath(`printed-note-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })
  }
})
