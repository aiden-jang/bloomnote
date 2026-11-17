import { expect, test } from '@playwright/test'

test('a large library keeps every response and search result without mounting every bouquet', async ({
  page,
}) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const gardens = Array.from({ length: 180 }, (_, index) => ({
    id: `${alphabet[Math.floor(index / alphabet.length)]}${alphabet[index % alphabet.length]}cdef`,
    from: 'Journey check',
    to: `Friend ${index + 1}`,
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
    swatches: ['#d993aa', '#f1cd83', '#cad6bd'],
  }))
  const favorite = gardens[0]!
  const batches: string[][] = []
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/me')
      return route.fulfill({
        json: { user: { id: 'library-check', displayName: 'Alex', email: 'library@example.test' } },
      })
    if (url.pathname === '/api/mine') return route.fulfill({ json: { sent: gardens, received: [] } })
    if (url.pathname === '/api/responses') {
      const ids = url.searchParams.get('ids')!.split(',')
      batches.push(ids)
      return route.fulfill({
        json: {
          responses: Object.fromEntries(
            ids.slice(0, 40).map((id) => [id, { waters: id === favorite.id ? 99 : 0, feelings: {} }]),
          ),
        },
      })
    }
    return route.fulfill({ json: {} })
  })
  await page.goto('/mine')
  await expect(page.getByRole('tab', { name: /sent.*180/ })).toBeVisible()
  const cards = page
    .locator('ul > li')
    .filter({ has: page.getByRole('button', { name: /^Share garden for/ }) })
  await expect(cards).toHaveCount(24)
  await expect(page.getByRole('complementary', { name: 'What came back from your gardens' })).toContainText(
    '99',
  )
  expect(batches.flat()).toHaveLength(180)
  expect(batches.every((batch) => batch.length <= 40)).toBe(true)
  await page.getByRole('button', { name: /show more gardens/ }).click()
  await expect(cards).toHaveCount(48)
  await expect(cards.nth(24).getByRole('link').first()).toBeFocused()
  await page.getByRole('combobox', { name: 'Sort gardens' }).selectOption('watered')
  await expect(cards).toHaveCount(24)
  await expect(cards.first()).toContainText('for Friend 1')
  await page.getByRole('searchbox', { name: 'Find a garden' }).fill('Friend 1')
  await expect(cards.first()).toContainText('for Friend 1')
  await page.getByRole('searchbox', { name: 'Find a garden' }).fill('Friend 87')
  await expect(cards).toHaveCount(1)
  await expect(cards.first()).toContainText('for Friend 87')
  await page.getByRole('button', { name: 'Clear garden search' }).click()
  await page.getByRole('combobox', { name: 'Sort gardens' }).selectOption('newest')
  if (process.env.PERF_CAPTURE) {
    await page.screenshot({
      path: `/private/tmp/apps-perf-bloomnote-${test.info().project.name}.png`,
      fullPage: true,
    })
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
