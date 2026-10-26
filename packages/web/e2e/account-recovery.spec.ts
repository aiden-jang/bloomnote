import { expect, test, type Page } from '@playwright/test'
import { startLocalApi } from './local-api.cjs'

const user = { id: 'preview', displayName: 'Alex', email: 'preview@example.test' }
const record = {
  id: 'AbCdEf',
  from: 'Alex',
  to: 'Sam',
  createdAt: '2026-10-10T12:00:00Z',
  swatches: ['#d993aa'],
}

async function account(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/me') return route.fulfill({ json: { user } })
    if (path === '/api/mine') return route.fulfill({ json: { sent: [record], received: [] } })
    if (path.endsWith('/responses')) return route.fulfill({ json: { responses: {} } })
    return route.fulfill({ json: {} })
  })
}

test('a failed account removal restores the garden and explains how to retry', async ({ page }) => {
  await account(page)
  await page.clock.install()
  await page.route('**/api/garden/AbCdEf', (route) => route.fulfill({ status: 503 }))
  await page.goto('/mine')
  await page.getByRole('button', { name: 'remove garden for Sam from your gardens', exact: true }).click()
  await expect(page.getByRole('link', { name: /^for Sam/ })).toHaveCount(0)
  await page.clock.fastForward(6001)
  await expect(page.getByRole('alert')).toContainText(/couldn.t remove/i)
  await expect(page.getByRole('link', { name: /^for Sam/ })).toBeVisible()
})

test('undo keeps an account garden without sending a removal', async ({ page }) => {
  await account(page)
  await page.clock.install()
  let deletes = 0
  await page.route('**/api/garden/AbCdEf', (route) => {
    deletes++
    return route.fulfill({ json: { ok: true } })
  })
  await page.goto('/mine')
  await page.getByRole('button', { name: 'remove garden for Sam from your gardens', exact: true }).click()
  await page.getByRole('button', { name: 'undo', exact: true }).click()
  await page.clock.fastForward(6001)
  await expect(page.getByRole('link', { name: /^for Sam/ })).toBeVisible()
  expect(deletes).toBe(0)
})

test('leaving the library commits a pending removal without waiting for the undo timer', async ({
  page,
  baseURL,
}) => {
  let deletes = 0
  const server = await startLocalApi(baseURL!, (path, method) => {
    if (method === 'DELETE' && path === '/api/garden/AbCdEf') deletes++
    if (path === '/api/me') return { user }
    if (path === '/api/mine') return { sent: [record], received: [] }
    return { responses: {} }
  })
  try {
    await page.clock.install()
    await page.goto(`${server.origin}/mine`)
    await page.getByRole('button', { name: 'remove garden for Sam from your gardens', exact: true }).click()
    await page.getByRole('link', { name: /grow another/ }).click()
    await expect.poll(() => deletes).toBe(1)
  } finally {
    await server.close()
  }
})

test('a library share failure leaves a selectable link and a retry', async ({ page }) => {
  await account(page)
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('Blocked')) },
      configurable: true,
    })
  })
  await page.goto('/mine')
  await page.getByRole('button', { name: 'Share garden for Sam', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/couldn.t share/i)
  await expect(page.getByRole('textbox', { name: 'Garden link for Sam', exact: true })).toHaveValue(
    /\/g\/AbCdEf$/,
  )
  await expect(page.getByRole('button', { name: 'Share garden for Sam', exact: true })).toBeEnabled()
})

test('a library image failure explains recovery instead of silently resetting', async ({ page }) => {
  await account(page)
  await page.route('**/api/garden?*', (route) => route.fulfill({ status: 503 }))
  await page.goto('/mine')
  await page.getByRole('button', { name: 'save image', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText(/couldn.t save the image/i)
  await expect(page.getByRole('button', { name: 'save image', exact: true })).toBeEnabled()
})

test('an unavailable session keeps the device library and offers sign-in recovery', async ({ page }) => {
  await account(page)
  let available = false
  await page.route('**/api/me', (route) =>
    available
      ? route.fulfill({ json: { user } })
      : route.fulfill({ status: 503, json: { error: 'AUTH_UNAVAILABLE' } }),
  )
  await page.goto('/mine')
  await expect(page.getByRole('alert')).toContainText(/couldn.t check your sign-in/i)
  await expect(page.getByText("the gardens you've grown, saved on this device.")).toBeVisible()
  available = true
  await page.getByRole('button', { name: 'try again', exact: true }).click()
  await expect(page.getByRole('link', { name: /^for Sam/ })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('a late session response cannot replace the current account with a device library', async ({ page }) => {
  await account(page)
  let release!: () => void
  const old = new Promise<void>((resolve) => {
    release = resolve
  })
  let finished!: () => void
  const oldFinished = new Promise<void>((resolve) => {
    finished = resolve
  })
  let calls = 0
  await page.route('**/api/me', async (route) => {
    if (++calls === 1) {
      await old
      await route.fulfill({ json: { user: null } })
      finished()
    } else await route.fulfill({ json: { user } })
  })
  try {
    await page.goto('/mine')
    await expect(page.getByRole('link', { name: /^for Sam/ })).toBeVisible()
    release()
    await oldFinished
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    )
    await expect(page.getByText("the gardens you've grown, saved on this device.")).toHaveCount(0)
    await expect(page.getByRole('link', { name: /^for Sam/ })).toBeVisible()
  } finally {
    release()
  }
})
