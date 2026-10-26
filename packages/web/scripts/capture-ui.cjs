const { chromium } = require(process.env.BLOOMNOTE_PLAYWRIGHT_MODULE || '../node_modules/@playwright/test')
const path = require('node:path')
const fs = require('node:fs/promises')
const assert = require('node:assert/strict')
const baseUrl = process.env.BLOOMNOTE_UI_URL ?? 'http://localhost:32100'
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
  occasion: 'thank-you',
  mood: 'tender',
  createdAt: '2026-10-10T12:00:00Z',
  secret: 'The soup was excellent. The jokes were fine.',
}
const records = ['Sam', 'Jamie', 'Maya', 'Casey'].map((to, i) => ({
  id: ['AbCdEf', 'BcDeFg', 'CdEfGh', 'DeFgHj'][i],
  from: 'Alex',
  to,
  occasion: 'thank-you',
  createdAt: '2026-10-10T12:00:00Z',
  swatches: [...flowers.map((f) => f.petalColors[0]), '#a7bca4', '#e6bdcd'],
}))
;(async () => {
  const out = process.env.BLOOMNOTE_UI_OUTPUT
    ? path.resolve(process.env.BLOOMNOTE_UI_OUTPUT)
    : path.resolve(__dirname, '../../../docs/ui-qa')
  await fs.mkdir(out, { recursive: true })
  const browser = await chromium.launch(
    process.env.BLOOMNOTE_BROWSER_PATH ? { executablePath: process.env.BLOOMNOTE_BROWSER_PATH } : {},
  )
  try {
    for (const name of [
      'composer',
      'draft',
      'generated',
      'growing',
      'recipient-sealed',
      'recipient-open',
      'scheduled',
      'library',
      'session-error',
      'removal-error',
      'library-share-error',
      'empty',
      'privacy',
    ]) {
      if (process.env.BLOOMNOTE_UI_CASE && process.env.BLOOMNOTE_UI_CASE !== name) continue
      console.log('Checking ' + name)
      for (const width of [1440, 390, 320, 430, 768]) {
        const context = await browser.newContext({
          viewport: { width, height: width === 1440 ? 1000 : 844 },
          reducedMotion: 'reduce',
          serviceWorkers: 'block',
        })
        const errors = []
        const page = await context.newPage()
        if (name === 'removal-error') await page.clock.install()
        if (name === 'library-share-error')
          await page.addInitScript(() => {
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
            Object.defineProperty(navigator, 'clipboard', {
              value: { writeText: () => Promise.reject(new Error('Blocked')) },
              configurable: true,
            })
          })
        page.on('pageerror', (e) => errors.push(e.message))
        await page.route('**/api/**', (route) => {
          const p = new URL(route.request().url()).pathname
          if (p === '/api/me' && name === 'session-error') return route.fulfill({ status: 503 })
          if (p === '/api/garden/AbCdEf' && route.request().method() === 'DELETE')
            return route.fulfill({ status: 503 })
          if (!p.startsWith('/api/')) return route.continue()
          if (p === '/api/me')
            return route.fulfill({
              json: {
                user:
                  name.startsWith('library') || name === 'removal-error'
                    ? { id: 'preview', displayName: 'Alex', email: 'preview@example.test' }
                    : null,
              },
            })
          if (p === '/api/mine') return route.fulfill({ json: { sent: records, received: [] } })
          if (p === '/api/design-garden' && name === 'growing')
            return new Promise((resolve) => page.once('close', resolve))
          if (p === '/api/design-garden')
            return route.fulfill({
              headers: { 'content-type': 'text/event-stream' },
              body: `event: complete\ndata: ${JSON.stringify({ garden: { flowers, bouquet_note: 'For showing up with exactly the right kind of company.' } })}\n\n`,
            })
          if (p === '/api/garden' && route.request().method() === 'POST')
            return route.fulfill({ json: { id: 'AbCdEf' } })
          if (p === '/api/garden')
            return route.fulfill({
              json: {
                garden: name === 'scheduled' ? { ...garden, unlockAt: '2030-10-10T12:00:00Z' } : garden,
              },
            })
          if (p.endsWith('/response')) return route.fulfill({ json: { waters: 0, feelings: {} } })
          return route.fulfill({
            status: 400,
            json: { error: 'Isolated visual preview does not write data.' },
          })
        })
        const url =
          name.startsWith('library') ||
          name === 'empty' ||
          name === 'session-error' ||
          name === 'removal-error'
            ? '/mine'
            : name.startsWith('recipient') || name === 'scheduled'
              ? '/g/AbCdEf'
              : name === 'privacy'
                ? '/privacy'
                : '/'
        await page.goto(new URL(url, baseUrl).href)
        if (name === 'composer' || name === 'draft' || name === 'generated' || name === 'growing') {
          await page.getByLabel('your note', { exact: true }).waitFor()
          if (name === 'draft' || name === 'generated' || name === 'growing') {
            await page.getByLabel('your note', { exact: true }).fill(garden.message)
            await page.getByLabel('from', { exact: true }).fill('Alex')
            await page.getByLabel('to', { exact: true }).fill('Sam')
            await page.getByRole('button', { name: 'grow their garden', exact: true }).waitFor()
          }
        }
        if (name === 'growing') {
          await page.getByRole('button', { name: 'grow their garden', exact: true }).click()
          await page.getByText('A small botanical overreaction.', { exact: true }).waitFor()
        }
        if (name === 'generated') {
          await page.getByRole('button', { name: 'grow their garden', exact: true }).click()
          await page.getByRole('link', { name: /preview the full reveal/ }).waitFor()
        }
        if (name.startsWith('recipient'))
          await page.getByRole('button', { name: 'open the garden', exact: true }).waitFor()
        if (name === 'recipient-open') {
          await page.getByRole('button', { name: 'open the garden', exact: true }).click()
          await page.getByText(garden.message, { exact: true }).waitFor()
          await page.waitForFunction((message) => {
            const text = [...document.querySelectorAll('p')].find((p) => p.textContent === message)
            return text && Number(getComputedStyle(text.parentElement).opacity) > 0.99
          }, garden.message)
        }
        if (name.startsWith('library') || name === 'removal-error')
          await page.getByRole('link', { name: /^for Sam/ }).waitFor()
        if (name === 'removal-error') {
          await page
            .getByRole('button', { name: 'remove garden for Sam from your gardens', exact: true })
            .click()
          await page.clock.fastForward(6001)
          await page.getByRole('alert').waitFor()
        }
        if (name === 'library-share-error') {
          await page.getByRole('button', { name: 'Share garden for Sam', exact: true }).click()
          await page.getByRole('alert').waitFor()
        }
        if (name === 'session-error') await page.getByRole('alert').waitFor()
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(1600)
        await page.evaluate(() => window.scrollTo(0, 0))
        assert.equal(
          await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          false,
          name + ' horizontal overflow at ' + width,
        )
        assert.deepEqual(errors, [], name + ' page errors')
        if (name === 'composer' && width <= 480) {
          const note = await page.getByLabel('your note', { exact: true }).boundingBox()
          assert.ok(note && note.y < 764, 'Writing starts inside the first phone viewport')
        }
        if (width === 1440 || width === 390)
          await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: true })
        await context.close()
      }
    }
    console.log('Visual checks passed at desktop, phone and intermediate widths.')
  } finally {
    await browser.close()
  }
})().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
