import { expect, test, type Page } from '@playwright/test'

const flowers = ['Dahlia', 'Cosmos', 'Sunflower'].map((name, i) => ({
  name,
  meaning: ['For showing up, every time.', 'For the very specific jokes.', 'For the brighter days.'][i],
  petalColors: [
    ['#d993aa', '#e6b7c5', '#f3d5de'],
    ['#a9a1cf', '#c4bddd', '#e2def0'],
    ['#e8b653', '#f1cd78', '#f8dea7'],
  ][i],
  centerColor: '#d9aa52',
  stemColor: '#607d56',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 88 + i * 8,
}))
const garden = {
  from: 'Alex',
  to: 'Sam',
  message: 'Thanks for showing up with soup and absolutely no useful advice. Exactly what I needed.',
  flowers,
  secret: 'The soup was excellent. The jokes were fine.',
}

async function mockApp(page: Page) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: { user: null } })
    if (path === '/api/garden' && route.request().method() === 'POST')
      return route.fulfill({ json: { id: 'AbCdEf' } })
    if (path === '/api/garden') return route.fulfill({ json: { garden } })
    if (path.endsWith('/response')) return route.fulfill({ json: { waters: 0, feelings: {} } })
    if (path === '/api/design-garden')
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: complete\ndata: ${JSON.stringify({ garden: { flowers, bouquet_note: 'For the company.' } })}\n\n`,
      })
    return route.fulfill({ status: 204 })
  })
}

for (const width of [320, 1440]) {
  test(`the recipient's open garden leads into a readable letter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockApp(page)
    await page.goto('/g/AbCdEf')
    await page.getByRole('button', { name: 'open the garden', exact: true }).click()
    const note = page.getByText(garden.message, { exact: true })
    await expect(note).toBeVisible()
    const scene = page.locator('[class*="scene"]').first()
    const plot = (await scene.boundingBox())!
    const letter = (await note.boundingBox())!
    expect(letter.y).toBeGreaterThan(plot.y + plot.height)
    await expect(scene).toHaveCSS('border-top-width', '0px')
    for (const flower of await page.getByRole('button', { name: /^(Dahlia|Cosmos|Sunflower):/ }).all()) {
      const box = (await flower.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(plot.x - 1)
      expect(box.x + box.width).toBeLessThanOrEqual(plot.x + plot.width + 1)
    }
    await page.getByRole('button', { name: 'a secret for you', exact: true }).click()
    await expect(page.getByText(garden.secret, { exact: true })).toBeVisible()
    await page.getByText('keep this garden', { exact: true }).click()
    await expect(page.getByRole('button', { name: 'watch it bloom again', exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`recipient-${width}.png`), fullPage: true })
  })
}

for (const width of [320, 1440]) {
  test(`the writing desk reads as a letter and still grows a shareable garden at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockApp(page)
    await page.goto('/')
    const note = page.getByLabel('your note', { exact: true })
    const recipient = page.getByLabel('to', { exact: true })
    await note.fill(garden.message)
    await recipient.fill('Sam')
    await page.getByPlaceholder('your name').fill('Alex')
    const toBox = (await recipient.boundingBox())!
    const noteBox = (await note.boundingBox())!
    expect(toBox.y + toBox.height).toBeLessThan(noteBox.y)
    await expect(note).toHaveCSS('border-top-width', '0px')
    await expect(page.getByText('Dear', { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`writing-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: /grow .* garden/i }).click()
    await expect(page.getByRole('button', { name: 'copy link', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Garden link', exact: true })).toHaveValue(/\/g\/AbCdEf$/)
  })
}

for (const width of [320, 390, 1440]) {
  test(`the compact desk keeps the example above writing and gives one hint at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockApp(page)
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const preview = page.getByRole('complementary', { name: 'Garden preview' })
    const recipient = page.getByLabel('to', { exact: true })
    const note = page.getByLabel('your note', { exact: true })
    const hint = page.locator('#note-hint')
    const previewBox = (await preview.boundingBox())!
    const toBox = (await recipient.boundingBox())!
    expect(previewBox.y + previewBox.height).toBeLessThanOrEqual(toBox.y)
    expect((await note.boundingBox())!.height).toBeLessThanOrEqual(width <= 600 ? 160 : 180)
    await expect(hint).toHaveCount(1)
    const invitation = await hint.innerText()
    await note.focus()
    await expect(hint).toHaveText('One specific detail goes a long way.')
    await recipient.focus()
    await expect(hint).toHaveText(invitation)
    for (const name of ['use this thought', 'another thought ↻']) {
      expect(
        (await page.getByRole('button', { name, exact: true }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44)
    }
    await note.fill('My note stays exactly as written.')
    await expect(preview).toHaveCount(0)
    await expect(hint).toHaveText('One specific detail goes a long way.')
    await expect(note).toHaveValue('My note stays exactly as written.')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })
}
