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

test('recipient actions stay unreachable until the animated reveal finishes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await mockApp(page)
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  const share = page.getByRole('button', { name: 'share this garden', exact: true, includeHidden: true })
  await expect(share).toBeHidden()
  await expect(share).toBeVisible()
  for (let step = 0; step < 5; step++) {
    await page.keyboard.press('Tab')
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
