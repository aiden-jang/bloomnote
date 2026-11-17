import { expect, test, type Page } from '@playwright/test'
import type { GardenData } from '../src/garden'

const flowers: GardenData['flowers'] = ['Cosmos', 'Dahlia', 'Bluebell'].map((name) => ({
  artVersion: 3,
  name,
  meaning: `Chosen for the little things: ${name}.`,
  petalColors: ['#b8a0cf', '#cebddf', '#e2d5ec'],
  centerColor: '#d9ac50',
  stemColor: '#78905b',
  petalShape: 'round',
  petalCount: 8,
  stemHeight: 95,
}))
const note = 'saved you the good strawberries. and the sunny seat by the window.'
const secret = 'the last one is definitely yours.'

async function fixture(page: Page) {
  const state = { designs: 0, saves: 0, receives: 0, reactions: 0, garden: null as GardenData | null }
  await page.route('**/api/**', (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    if (path === '/api/me')
      return route.fulfill({
        json: {
          user: { id: 'gifting-preview', displayName: 'Alex', email: 'preview@example.test' },
        },
      })
    if (path === '/api/design-garden') {
      state.designs++
      return route.fulfill({
        contentType: 'text/event-stream',
        body: `event: complete\ndata: ${JSON.stringify({ garden: { flowers, bouquet_note: '' } })}\n\n`,
      })
    }
    if (path === '/api/garden' && request.method() === 'POST') {
      state.saves++
      state.garden = request.postDataJSON() as GardenData
      return route.fulfill({ json: { id: state.saves === 1 ? 'AbCdEf' : 'BcDeFg' } })
    }
    if (path === '/api/garden') return route.fulfill({ json: { garden: state.garden } })
    if (path.endsWith('/receive')) {
      state.receives++
      return route.fulfill({ json: { saved: true } })
    }
    if (path.endsWith('/response')) {
      if (request.method() === 'POST') state.reactions++
      return route.fulfill({ json: { waters: 0, feelings: {} } })
    }
    return route.fulfill({ status: 204 })
  })
  return state
}

async function write(page: Page) {
  await page.goto('/')
  await page.getByLabel('to', { exact: true }).fill('Alexandria Charlotte')
  await page.getByPlaceholder('your name').fill('Alex & Bea')
  await page.getByLabel('your note', { exact: true }).fill(note)
  await page.getByText('add a secret', { exact: true }).click()
  await page.getByLabel('a little aside they can tap to reveal', { exact: true }).fill(secret)
}

for (const width of [320, 1440]) {
  test(`the saved gift previews and rewraps without recipient writes at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const state = await fixture(page)
    await write(page)
    await page.getByRole('button', { name: /^grow .+ garden$/i }).click()
    const preview = page.getByRole('region', { name: 'Recipient preview', exact: true })
    await expect(page.getByRole('heading', { name: 'Alexandria Charlotte’s garden is ready' })).toBeFocused()
    const open = preview.getByRole('button', { name: 'preview the opening', exact: true })
    await expect(open).toContainText('for Alexandria Charlotte')
    await expect(open).toContainText('from Alex & Bea')
    await expect(preview.getByText(note, { exact: true })).toHaveCount(0)
    await open.click()
    await expect(preview.getByRole('heading', { level: 3 })).toBeFocused()
    await expect(preview.getByText(note, { exact: true })).toBeVisible()
    await expect(preview.getByText(secret, { exact: true })).toHaveCount(0)
    await preview.getByRole('button', { name: 'a secret for you', exact: true }).click()
    await expect(preview.getByText(secret, { exact: true })).toBeVisible()
    await preview.getByRole('button', { name: /^Cosmos:/ }).click()
    await expect(preview.getByRole('button', { name: 'share this flower', exact: true })).toHaveCount(0)
    await expect(preview.getByRole('button', { name: 'keep in my flower journal', exact: true })).toHaveCount(
      0,
    )
    await expect(preview.getByRole('button', { name: 'water it', exact: true })).toHaveCount(0)
    await preview.getByRole('button', { name: 'wrap it back up', exact: true }).click()
    await expect(open).toBeFocused()
    await expect(preview.getByText(secret, { exact: true })).toHaveCount(0)
    await open.click()
    await expect(preview.getByText(note, { exact: true })).toBeVisible()
    expect(state.designs).toBe(1)
    expect(state.saves).toBe(1)
    expect(state.receives).toBe(0)
    expect(state.reactions).toBe(0)
    expect(state.garden).toMatchObject({
      message: note,
      secret,
      from: 'Alex & Bea',
      to: 'Alexandria Charlotte',
    })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`gift-preview-${width}.png`), fullPage: true })
    await page.goto('/g/AbCdEf')
    await expect.poll(() => state.receives).toBeGreaterThan(0)
    await page.getByRole('button', { name: 'open the garden', exact: true }).click()
    await expect(page.getByText(note, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'water it', exact: true })).toBeVisible()
  })
}

test('a scheduled gift previews now while its real recipient link remains sealed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const state = await fixture(page)
  await write(page)
  await page.getByRole('button', { name: 'choose when it opens', exact: true }).click()
  await page.getByRole('button', { name: 'tomorrow', exact: true }).click()
  await page.getByRole('button', { name: /^grow .+ garden$/i }).click()
  await expect(page.getByText('You can preview the opening now.', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'preview the opening', exact: true }).click()
  await expect(page.getByText(note, { exact: true })).toBeVisible()
  expect(new Date(state.garden!.unlockAt!).getTime()).toBeGreaterThan(Date.now())
  await page.goto('/g/AbCdEf')
  await expect(page.getByRole('button', { name: 'open the garden', exact: true })).toHaveCount(0)
  await expect(page.getByText(note, { exact: true })).toHaveCount(0)
})

for (const mode of ['normal motion', 'no view transitions', 'reduced motion']) {
  test(`growing hands off in place with ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ reducedMotion: mode === 'reduced motion' ? 'reduce' : 'no-preference' })
    if (mode === 'no view transitions') {
      await page.addInitScript(() =>
        Object.defineProperty(document, 'startViewTransition', { value: undefined }),
      )
    }
    const state = await fixture(page)
    let finish!: () => void
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    await page.route('**/api/design-garden', async (route) => {
      state.designs++
      await pending
      await route.fulfill({
        contentType: 'text/event-stream',
        body: `event: complete\ndata: ${JSON.stringify({ garden: { flowers, bouquet_note: '' } })}\n\n`,
      })
    })
    try {
      await write(page)
      await page.getByRole('button', { name: /^grow .+ garden$/i }).click()
      const growing = page.getByRole('heading', { name: 'Growing their garden.', exact: true })
      await expect(growing).toBeFocused()
      await expect
        .poll(() =>
          page.evaluate(() =>
            document
              .getAnimations()
              .some(
                (animation) =>
                  animation instanceof CSSAnimation &&
                  animation.animationName.includes('resultArrive') &&
                  animation.playState === 'running',
              ),
          ),
        )
        .toBe(false)
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      const before = (await growing.boundingBox())!
      await page.evaluate(() => {
        const observer = new MutationObserver(() => {
          if (
            !Array.from(document.querySelectorAll('[data-result-entrance] > h2')).some((heading) =>
              heading.textContent?.includes('is ready'),
            )
          )
            return
          observer.disconnect()
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const entrance = document
                .getAnimations()
                .find(
                  (animation) =>
                    animation instanceof CSSAnimation && animation.animationName.includes('resultArrive'),
                )
              const effect = entrance?.effect
              // A slow frame can arrive after the fade has finished; its duration and keyframes
              // still prove that it faded instead of swapping instantly.
              Object.assign(window, {
                resultEntrance:
                  effect instanceof KeyframeEffect
                    ? {
                        duration: Number(effect.getComputedTiming().activeDuration),
                        opacities: effect.getKeyframes().map((frame) => Number(frame.opacity)),
                      }
                    : null,
              })
            }),
          )
        })
        observer.observe(document.body, { childList: true, subtree: true })
      })
      await expect(page.getByRole('button', { name: 'copy link', exact: true })).toHaveCount(0)
      finish()
      const ready = page.getByRole('heading', { name: 'Alexandria Charlotte’s garden is ready', exact: true })
      await expect(ready).toBeFocused()
      await expect.poll(() => page.evaluate(() => 'resultEntrance' in window)).toBe(true)
      const entrance = await page.evaluate(
        () =>
          (window as unknown as { resultEntrance: { duration: number; opacities: number[] } | null })
            .resultEntrance,
      )
      if (mode === 'reduced motion') expect(entrance).toBeNull()
      else {
        expect(entrance).not.toBeNull()
        expect(entrance!.duration).toBeGreaterThan(0)
        expect(entrance!.duration).toBeLessThanOrEqual(600)
        expect(entrance!.opacities).toContain(0)
        expect(entrance!.opacities).toContain(1)
      }
      await expect(ready).toBeVisible()
      await expect
        .poll(() =>
          page.evaluate(() =>
            document
              .getAnimations()
              .some(
                (animation) =>
                  animation instanceof CSSAnimation &&
                  animation.animationName.includes('resultArrive') &&
                  animation.playState === 'running',
              ),
          ),
        )
        .toBe(false)
      expect(Math.abs((await ready.boundingBox())!.y - before.y)).toBeLessThan(2)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect(state.designs).toBe(1)
      expect(state.saves).toBe(1)
      expect(state.garden?.message).toBe(note)
    } finally {
      finish()
    }
  })
}
