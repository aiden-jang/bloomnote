import { expect, test, type Page } from '@playwright/test'

const flowers = ['Dahlia', 'Cosmos', 'Sunflower'].map((name) => ({
  artVersion: 3,
  name,
  meaning: 'For the company.',
  petalColors: ['#d993aa', '#e6b7c5', '#f3d5de'],
  centerColor: '#d9aa52',
  stemColor: '#607d56',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}))
async function open(page: Page, occasion = 'birthday', reducedMotion: 'reduce' | 'no-preference' = 'reduce') {
  await page.emulateMedia({ reducedMotion })
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: { user: null } })
    if (path === '/api/garden')
      return route.fulfill({
        json: {
          garden: {
            from: 'Alex',
            to: 'Sam',
            message: 'Thanks for the company.',
            occasion,
            flowers,
          },
        },
      })
    if (path.endsWith('/response')) return route.fulfill({ json: { waters: 0, feelings: {} } })
    return route.fulfill({ status: 204 })
  })
  await page.goto('/g/AbCdEf')
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  await expect(page.getByText('Thanks for the company.', { exact: true })).toBeVisible()
}

test('a feeling sends before watering and a late initial read cannot erase it', async ({ page }) => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let feelings = 0
  let waters = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/water')) waters++
  })
  await open(page)
  // Reload before opening so the response lookup can be held until after the feeling succeeds.
  await page.route('**/api/garden/AbCdEf/response', async (route) => {
    await pending
    await route.fulfill({ json: { waters: 0, feelings: {} } })
  })
  await page.route('**/api/garden/AbCdEf/feeling', async (route) => {
    feelings++
    expect(route.request().postDataJSON()).toEqual({ feeling: 'love' })
    await route.fulfill({ json: { waters: 0, feelings: { love: 1 } } })
  })
  await page.reload()
  await page.getByRole('button', { name: 'open the garden', exact: true }).click()
  await page.getByRole('button', { name: 'love', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'sent back a little love' })).toBeVisible()
  const readFinished = page.waitForResponse('**/api/garden/AbCdEf/response')
  release()
  await readFinished
  await expect(page.getByText('♡ 1', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'water it', exact: true })).toBeVisible()
  expect(feelings).toBe(1)
  expect(waters).toBe(0)
})

test('all reaction targets fit a narrow phone after the note', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await open(page)
  const choices = page.getByRole('group', { name: 'send a feeling back', exact: true })
  const note = (await page.getByText('Thanks for the company.', { exact: true }).boundingBox())!
  for (const button of await choices.getByRole('button').all()) {
    const box = (await button.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
    expect(box.y).toBeGreaterThan(note.y)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('the bee hat supports keyboard, settles automatically and writes nothing', async ({ page }) => {
  const writes: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST') writes.push(request.url())
  })
  await open(page)
  const bee = page.getByRole('button', { name: 'give the bee a petal hat', exact: true })
  await expect(bee).toBeVisible()
  const box = (await bee.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  const before = writes.length
  await bee.press('Enter')
  await expect(bee).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('[data-petal-hat]')).toHaveCount(1)
  await expect(page.getByText('management.', { exact: true })).toBeVisible()
  await expect(bee).toHaveAttribute('aria-pressed', 'false', { timeout: 6000 })
  await expect(bee).toBeFocused()
  await bee.press('Space')
  await expect(bee).toHaveAttribute('aria-pressed', 'true')
  await bee.press('Space')
  await expect(bee).toHaveAttribute('aria-pressed', 'false')
  expect(writes.length).toBe(before)
})

test('the bee pauses in place while focused during a flight', async ({ page }) => {
  await page.clock.install()
  await open(page, 'birthday', 'no-preference')
  const bee = page.getByRole('button', { name: 'give the bee a petal hat', exact: true })
  await expect(bee).toBeVisible()
  await page.clock.runFor(4100)
  const inFlight = (await bee.boundingBox())!
  await bee.focus()
  const first = (await bee.boundingBox())!
  expect(Math.abs(first.x - inFlight.x) + Math.abs(first.y - inFlight.y)).toBeLessThan(2)
  await page.clock.runFor(8000)
  await expect
    .poll(async () => {
      const box = (await bee.boundingBox())!
      return Math.abs(box.x - first.x) + Math.abs(box.y - first.y)
    })
    .toBeLessThan(1)
  await bee.press('Enter')
  await expect(page.getByText('management.', { exact: true })).toBeVisible()
})

for (const occasion of ['sympathy', 'get-well', 'unknown']) {
  test(`${occasion} has no petal-hat joke`, async ({ page }) => {
    await open(page, occasion)
    await expect(page.getByRole('button', { name: 'give the bee a petal hat' })).toHaveCount(0)
    await expect(page.getByText('management.', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'comfort', exact: true })).toBeVisible()
    if (occasion !== 'unknown') {
      await expect(page.getByRole('button', { name: 'joy', exact: true })).toHaveCount(0)
    }
  })
}
