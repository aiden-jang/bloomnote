import { expect, test } from '@playwright/test'

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
