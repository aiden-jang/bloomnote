import { expect, test } from '@playwright/test'

test('leaving the note keeps the next control steady after the keyboard delay', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.clock.install({ time: new Date('2026-10-26T12:00:00Z') })
  await page.addInitScript(() => {
    const scrollIntoView = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (options) {
      if (this.id === 'note' && document.activeElement !== this)
        document.documentElement.dataset.lateNoteScroll = 'true'
      scrollIntoView.call(this, options)
    }
  })
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: null } }))
  await page.goto('/')
  await page.evaluate(() => document.fonts.ready)
  await page.clock.pauseAt(new Date('2026-10-26T12:01:00Z'))
  await page.getByLabel('your note', { exact: true }).fill('Thanks for the soup and company.')
  await page.getByLabel('to', { exact: true }).fill('Sam')
  const grow = page.getByRole('button', { name: 'grow their garden', exact: true })
  await grow.scrollIntoViewIfNeeded()
  await page.clock.runFor(1000)
  await expect(page.locator('html')).not.toHaveAttribute('data-late-note-scroll', 'true')
})

test('update discovery keeps the note intact and can be dismissed', async ({ page }) => {
  await page.goto('/')
  const note = page.getByLabel('your note', { exact: true })
  await note.fill('Keep this exact note, please.')
  await page.route('**/', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<script type="module" src="/assets/next-release.js"></script>',
    }),
  )
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  const update = page.getByRole('status', { name: 'App update' })
  await expect(update).toBeVisible()
  await expect(note).toHaveValue('Keep this exact note, please.')
  await update.getByRole('button', { name: 'Later', exact: true }).click()
  await expect(update).toBeHidden()
})

test('garden library filters survive opening a garden and going back', async ({ page }) => {
  await page.route('**/api/me', (route) => route.fulfill({ json: { user: null } }))
  await page.addInitScript(() => {
    localStorage.setItem(
      'bloomnote:mine',
      JSON.stringify(
        ['AbCdEf', 'GhJkLm'].map((id, i) => ({
          id,
          to: `Soup friend ${i}`,
          from: 'Alex',
          createdAt: '2026-10-14T12:00:00Z',
          swatches: ['#d993aa'],
        })),
      ),
    )
    localStorage.setItem('bloomnote:pinned-gardens', JSON.stringify(['AbCdEf']))
  })
  await page.goto('/mine?q=soup&sort=oldest&pinned=1')
  await expect(page.getByRole('searchbox')).toHaveValue('soup')
  await expect(page.getByLabel('Sort gardens')).toHaveValue('oldest')
  await page.getByRole('link', { name: /grow another/ }).click()
  await page.goBack()
  await expect(page.getByRole('searchbox')).toHaveValue('soup')
  await expect(page.getByLabel('Sort gardens')).toHaveValue('oldest')
  await expect(page).toHaveURL(/pinned=1/)
})
