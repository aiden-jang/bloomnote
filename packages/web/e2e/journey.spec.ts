import { expect, test, type Page } from '@playwright/test'

/**
 * The whole product in one pass: arrive, write a note, watch it bloom, get a link, open that link
 * as the recipient.
 *
 * Only the Gemini call is faked, and it is faked at the browser's network layer rather than by
 * changing any application code, so the app under test is byte-for-byte the one that ships. That
 * keeps the suite free (no quota), deterministic (no sampled model), and still honest about
 * everything that actually breaks: the SSE parsing, the bloom, the KV write, the short link, the
 * routing, and the recipient render.
 */

/** snake_case bouquet_note, because that is what the Worker's `complete` event sends. */
const GARDEN = {
  bouquet_note: 'for the drive, and for not making it a thing.',
  flowers: [
    {
      name: 'Hydrangea',
      meaning: 'For four hours in the rain.',
      petalColors: ['#6f8fd0', '#8fa8dd', '#b3c4ea'],
      centerColor: '#f0c674',
      stemColor: '#5f8a52',
      petalShape: 'round',
      petalCount: 9,
      stemHeight: 96,
    },
    {
      name: 'Dahlia',
      meaning: 'For never once making it a big deal.',
      petalColors: ['#d1477a', '#e06b96', '#ef9ab8'],
      centerColor: '#f7e3a1',
      stemColor: '#5f8a52',
      petalShape: 'star',
      petalCount: 12,
      stemHeight: 104,
    },
    {
      name: 'Sunflower',
      meaning: 'For the hospital car park, of all places.',
      petalColors: ['#e8a33d', '#f0b95c', '#f6d089'],
      centerColor: '#6b4423',
      stemColor: '#5f8a52',
      petalShape: 'elongated',
      petalCount: 14,
      stemHeight: 112,
    },
  ],
}

const NOTE =
  'you drove four hours in the rain to sit in a hospital car park with me and did not once make it a big deal.'

/** The whole SSE body at once: the client reads it to EOF exactly as it reads the real stream. */
async function stubDesign(page: Page): Promise<void> {
  await page.route('**/api/design-garden', async (route) => {
    const frames = [
      `event: start\ndata: ${JSON.stringify({ ok: true })}\n\n`,
      `event: thinking\ndata: {}\n\n`,
      `event: complete\ndata: ${JSON.stringify({ garden: GARDEN })}\n\n`,
    ].join('')
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: frames,
    })
  })
}

/** Serves a different garden on each call, so a reroll is distinguishable from a repaint. */
async function stubDesignSequence(page: Page, gardens: unknown[]): Promise<void> {
  let call = 0
  await page.route('**/api/design-garden', async (route) => {
    const garden = gardens[Math.min(call, gardens.length - 1)]
    call += 1
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body:
        `event: start\ndata: ${JSON.stringify({ ok: true })}\n\n` +
        `event: complete\ndata: ${JSON.stringify({ garden })}\n\n`,
    })
  })
}

const petals = (page: Page) => page.locator('svg path')

/*
 * Every page runs as a reduced-motion visitor.
 *
 * Necessary, not cosmetic: "open the garden" carries an infinite attention pulse, so Playwright's
 * stability check never passes and the click times out after a minute. Forcing the click would
 * paper over exactly the "can a person actually press this" class of problem this suite is for.
 *
 * Done here with an explicit call rather than `reducedMotion` in the config, because that setting
 * did not reach the page: a probe showed `matchMedia('(prefers-reduced-motion: reduce)')` false
 * with it set in `use`, and true immediately after calling this. A config option that silently
 * does nothing is worse than no config option.
 *
 * The app already turns these animations off under prefers-reduced-motion, so this puts the run on
 * a path it deliberately supports. The trade-off is real: the entrance animations themselves (the
 * staged bloom, the typewriter note) are not exercised, only their end state.
 */
/*
 * A different caller per test, and a different range per run.
 *
 * Sharing one address puts every test in one rate-limit bucket, and a run spends enough of
 * LIMITS.create that the suite starts failing on whichever test comes next. Numbering the tests
 * alone is not enough: the same test draws the same address every run, so the buckets still fill
 * up across reruns, which showed as a create timing out on a different test each time. The pid
 * gives each run its own range. Only the local worker trusts this header; Cloudflare overwrites
 * it at the edge.
 */
const RUN_RANGE = `10.${(process.pid >> 8) & 0xff}.${process.pid & 0xff}`
let visitor = 0
/* Also handed to page.request below: setExtraHTTPHeaders covers the browser's own requests and
   not the API context, so without this every helper-made garden shares one bucket. */
let callerIp = ''

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  visitor += 1
  callerIp = `${RUN_RANGE}.${visitor}`
  await page.setExtraHTTPHeaders({ 'cf-connecting-ip': callerIp })
})

/*
 * `react/jsx-no-comment-textnodes` is the real guard for this now. This stays because the lint rule
 * only sees JSX, and it is the whole-page version of the question nothing else here asks: what does
 * the screen say that it should not?
 */
test('no screen leaks comment syntax as visible text', async ({ page }) => {
  for (const path of ['/', '/mine', '/privacy', '/terms', '/g/zzzz99']) {
    await page.goto(path)
    await expect(page.locator('body')).not.toContainText('/*')
    await expect(page.locator('body')).not.toContainText('*/')
  }
})

test.describe('compose → bloom → share → recipient', () => {
  test('a note in progress survives a refresh in the same tab', async ({ page }) => {
    await page.goto('/')

    await page.getByPlaceholder('your name').fill('Aiden')
    await page.getByPlaceholder('their name').fill('Nadia')
    await page.getByLabel('your note').fill('I kept thinking about that rainy drive home.')

    // Wait for the tab-local recovery cache rather than assuming React has
    // flushed its effect before the reload starts.
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('bloomnote:draft:/'))).not.toBeNull()
    await page.reload()

    await expect(page.getByPlaceholder('your name')).toHaveValue('Aiden')
    await expect(page.getByPlaceholder('their name')).toHaveValue('Nadia')
    await expect(page.getByLabel('your note')).toHaveValue('I kept thinking about that rainy drive home.')
    await expect(page.getByRole('status')).toContainText('Your draft is still here.')

    // Clear means clear: a deliberate reset must win over recovery.
    await page.getByRole('button', { name: 'clear draft' }).click()
    await page.reload()
    await expect(page.getByPlaceholder('your name')).toHaveValue('')
    await expect(page.getByPlaceholder('their name')).toHaveValue('')
    await expect(page.getByLabel('your note')).toHaveValue('')
  })

  test('a garden can be grown, shared, and opened', async ({ page }) => {
    // Keep the recipient handoff inside the browser test: the native sheet itself belongs to the
    // OS, but its successful completion must produce the same in-page confirmation everywhere.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.resolve(),
      })
    })
    await stubDesign(page)
    await page.goto('/')

    // --- Arrive -----------------------------------------------------------------------------
    // The homepage hero grows a real demo garden rather than showing an empty plot. If that
    // regresses, a first-time visitor's first impression is a blank rectangle again.
    await expect(page.getByRole('heading', { name: 'bloomnote' })).toBeVisible()
    await expect(petals(page).first()).toBeVisible()

    // --- Write ------------------------------------------------------------------------------
    await page.getByPlaceholder('your name').fill('Aiden')
    await page.getByPlaceholder('their name').fill('Nadia')
    await page.getByLabel('your note').fill(NOTE)

    // Starting a draft clears the demo and shrinks the plot to a waiting bed, so the note field
    // is not pushed below the fold by 260px of empty sky.
    const scene = page.locator('[class*="scene"]').first()
    await expect(scene).toHaveJSProperty('offsetHeight', 132)

    // --- Bloom ------------------------------------------------------------------------------
    await page.getByRole('button', { name: /grow .* garden/i }).click()

    await expect(page.getByText(NOTE)).toBeVisible()
    await expect(page.getByText('for the drive, and for not making it a thing.').first()).toBeVisible()

    for (const f of GARDEN.flowers) {
      await expect(page.getByText(f.name, { exact: true }).first()).toBeVisible()
      await expect(page.getByText(f.meaning).first()).toBeVisible()
    }

    // --- Share ------------------------------------------------------------------------------
    const link = page.getByText(/\/g\/[A-Za-z0-9]{6}/).first()
    await expect(link).toBeVisible()
    const shareUrl = (await link.textContent())!.trim()
    expect(shareUrl).toMatch(/\/g\/[A-Za-z0-9]{6}$/)

    /*
     * Seed a private journal before arriving as the recipient.
     *
     * Written the way people actually write, because the extraction's whole difficulty is false
     * positives: names opening sentences, a possessive, a weekday, a shouted word, and a capitalised
     * feeling. If any of those became a "person" the panel would be claiming a relationship with Tuesday.
     */
    await page.addInitScript(() => {
      const memories = [
        "Nadia's party was loud but I was genuinely happy. we went to Roberta after.",
        'Theo drove me home on Tuesday. I was exhausted and he did not make it a thing.',
        'Nadia called. she sounded tired. honestly? Tired too.',
        'Theo again. we sat at Roberta and said almost nothing.',
        'Suddenly everything felt lighter. Nadia would laugh at me writing that.',
      ]
      window.localStorage.setItem(
        'bloomnote.flower-journal.v1',
        JSON.stringify(
          memories.map((memory, i) => ({
            id: `seed-${i}`,
            gardenId: `seed-g-${i}`,
            flowerIndex: 0,
            flowerName: ['Hydrangea', 'Peony', 'Aster', 'Freesia', 'Dahlia'][i],
            meaning: 'a seeded memory',
            colors: ['#e11d48'],
            memory,
            savedAt: new Date(Date.UTC(2026, 7, 1 + i)).toISOString(),
          })),
        ),
      )
    })

    // --- Receive ----------------------------------------------------------------------------
    // A fresh context would be more faithful, but same-page navigation still exercises the part
    // that matters: the recipient route resolving a stored garden from its id alone.
    await page.goto(new URL(shareUrl).pathname)

    // Not getByText('Aiden'): the footer credit "made by aiden jang" also matches it.
    await expect(page.getByText(/grew Nadia a garden/i)).toBeVisible()
    // The button removes itself on click, so focus has to be sent somewhere deliberately.
    const heading = page.getByRole('heading', { level: 1, name: /grew Nadia a garden/i })
    await expect(heading).toBeVisible()
    await page.getByRole('button', { name: /open the garden/i }).click()
    await expect(heading).toBeFocused()

    await expect(page.getByText(NOTE)).toBeVisible()
    await expect(petals(page).first()).toBeVisible()
    for (const f of GARDEN.flowers) {
      await expect(page.getByText(f.meaning).first()).toBeVisible()
    }
    await expect(page.getByRole('link', { name: /grow Aiden a garden/i })).toBeVisible()

    // --- The flower panel -------------------------------------------------------------------
    // Nothing else asserts the two-layer Escape or the focus handoff, and both live in the panel.
    const first = GARDEN.flowers[0]!
    const slot = page.getByRole('button', { name: new RegExp(`^${first.name}:`) })
    await slot.click()
    const peek = page.locator('#flower-peek')
    await expect(peek).toBeVisible()

    await peek.getByRole('button', { name: /keep in my flower journal/i }).click()
    await peek.getByRole('textbox').fill('the afternoon it arrived')
    await peek.getByRole('button', { name: /press into journal/i }).click()
    await expect(peek.getByRole('button', { name: /edit journal memory/i })).toBeVisible()

    await peek.getByRole('button', { name: /edit journal memory/i }).click()
    await page.keyboard.press('Escape')
    await expect(peek).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(peek).toBeHidden()
    await expect(slot).toBeFocused()

    // --- Constellations ---------------------------------------------------------------------
    // The journal and its constellations sit inside the collapsed "keep this garden" disclosure.
    await page.getByText('keep this garden').click()
    const threads = page.getByRole('region', { name: /what keeps coming back/i })
    await expect(threads).toBeVisible()
    // Recurring across entries, and Roberta as a place because both mentions follow a preposition.
    await expect(threads.getByRole('button', { name: /Nadia/ })).toBeVisible()
    await expect(threads.getByRole('button', { name: /Theo/ })).toBeVisible()
    await expect(threads.getByRole('button', { name: /Roberta/ })).toBeVisible()
    // The false positives that would destroy any trust in this panel.
    for (const wrong of ['Tuesday', 'Suddenly', 'Honestly', 'Tired']) {
      await expect(threads.getByRole('button', { name: new RegExp(`^\\W*${wrong}`, 'i') })).toHaveCount(0)
    }
    await threads.getByRole('button', { name: /Nadia/ }).click()
    await expect(page.getByText(/Nadia is in 3 of your entries/i)).toBeVisible()

    /*
     * The recap, and quiet mode.
     *
     * The seeded entries are dated August 2026, so whether they fall inside the recap's recent window
     * depends on when this runs. Assert the invariant that holds either way: whatever it says, it never
     * says it with a number or a cadence, because that is the line between a recap and a scoreboard.
     */
    const shelf = page.getByRole('region', { name: /my flower journal/i })
    await expect(shelf).toBeVisible()
    const recap = shelf.locator('p').filter({ hasText: /^lately,/ })
    if (await recap.count()) {
      await expect(recap.first()).not.toHaveText(/\d|streak|week|day|missed|behind/i)
    }
    const quietToggle = shelf.getByRole('button', { name: /show the tallies/i })
    await expect(quietToggle).toBeVisible()
    await quietToggle.click()
    await expect(shelf.getByRole('button', { name: /hide the tallies/i })).toBeVisible()
    /*
     * Either outcome counts, because which one happens is the platform's choice, not the app's.
     * A phone has navigator.share and reports "garden shared"; a desktop browser (and this headless
     * one) has no share sheet, falls back to the clipboard, and reports "link copied". Asserting only
     * the native wording meant this could never pass anywhere the fallback runs, which is where it
     * runs in CI.
     */
    const shareButton = page.getByRole('button', { name: 'Share this garden' })
    await shareButton.click()
    await expect(page.getByRole('button', { name: /garden shared|link copied/i })).toBeVisible()

    // --- Reduced motion ---------------------------------------------------------------------
    /*
     * The legend rows start at opacity 0 and are faded in by an animation. Turning that animation
     * off without also spelling out the end state leaves them invisible forever, which is worse
     * than the motion was.
     *
     * Assert the computed opacity, not toBeVisible(). Playwright counts a fully transparent
     * element as visible, so the obvious assertion passes while nothing is on screen.
     *
     * Don't call emulateMedia here. The beforeEach already did, so it is a no-op that reads as the
     * thing under test.
     */
    await page.reload()
    await page.getByRole('button', { name: /open the garden/i }).click()
    const legendRows = page.getByRole('region', { name: /what each flower means/i }).getByRole('listitem')
    await expect(legendRows).toHaveCount(GARDEN.flowers.length)
    for (let i = 0; i < GARDEN.flowers.length; i++) {
      await expect(legendRows.nth(i)).toHaveCSS('opacity', '1')
    }
  })

  /*
   * Reroll and the failure path, the two branches of the design lifecycle the happy path never
   * touches. Both were uncovered while that lifecycle sat in the middle of a 889-line component,
   * which is the worst combination for changing it.
   */
  test('rerolling replaces the flowers rather than repainting the same ones', async ({ page }) => {
    const second = {
      ...GARDEN,
      flowers: [{ ...GARDEN.flowers[0]!, name: 'Bluebell', meaning: 'For the second attempt.' }],
    }
    await stubDesignSequence(page, [GARDEN, second])
    await page.goto('/')

    await page.getByPlaceholder('their name').fill('Nadia')
    await page.getByLabel('your note').fill(NOTE)
    await page.getByRole('button', { name: /grow .* garden/i }).click()
    await expect(page.getByText(GARDEN.flowers[0]!.name, { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /different flowers/i }).click()
    await expect(page.getByText('Bluebell', { exact: true }).first()).toBeVisible()
    await expect(page.getByText(GARDEN.flowers[0]!.name, { exact: true })).toHaveCount(0)
  })

  test('a failed generation says so and leaves the note intact', async ({ page }) => {
    await page.route('**/api/design-garden', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
        body: 'event: error\ndata: {"error":"bloomnote is at capacity for today. try again tomorrow."}\n\n',
      })
    })
    await page.goto('/')

    await page.getByPlaceholder('their name').fill('Nadia')
    await page.getByLabel('your note').fill(NOTE)
    await page.getByRole('button', { name: /grow .* garden/i }).click()

    await expect(page.getByRole('alert')).toContainText('at capacity for today')
    // The note has to survive: losing what someone wrote because generation failed is the one
    // outcome this screen cannot have.
    await expect(page.getByLabel('your note')).toHaveValue(NOTE)
  })

  test('a dead link says the garden is still there', async ({ page }) => {
    // Recipients arrive by pasted link, so a truncated one is a normal event, not an edge case.
    // Gardens have no TTL, so this page must never claim the gift expired.
    await page.goto('/g/zzzz99')
    // `.` for the apostrophe: the copy uses a typographic one (&rsquo;), not U+0027.
    await expect(page.getByText(/didn.t lead anywhere/i)).toBeVisible()
    await expect(page.getByText(/gardens never expire/i)).toBeVisible()
    // The assertion that matters, stated as the rule rather than as a count: this page must
    // never tell someone the gift they were sent is gone, because it isn't.
    await expect(page.locator('body')).not.toContainText(/(link|garden).{0,20}expired/i)
  })
})

/** A garden written straight to the real KV, for the screens that need one to exist first. */
async function createGarden(page: Page, extra: Record<string, unknown> = {}): Promise<string> {
  const response = await page.request.post('/api/garden', {
    headers: {
      origin: new URL(page.url() || 'http://localhost:32100').origin,
      'cf-connecting-ip': callerIp,
    },
    data: { from: 'Aiden', to: 'Nadia', message: NOTE, ...GARDEN, ...extra },
  })
  // Say so here rather than returning an undefined id: a refused create used to surface fifteen
  // seconds later as an empty list, which reads like a rendering bug.
  if (!response.ok()) {
    throw new Error(`could not seed a garden: ${response.status()} ${await response.text()}`)
  }
  const body = (await response.json()) as { id: string }
  return body.id
}

/*
 * The archive, both halves of it.
 *
 * Every one of these was verified by hand and by nothing else: the signed-out list, its search, its
 * sort and its pinned filter all share one hook and one toolbar with the signed-in list, which is
 * exactly the shape where a change lands on one and silently misses the other.
 */
test.describe('your gardens', () => {
  test('lists, searches, sorts and filters the on-device archive', async ({ page }) => {
    await page.goto('/')
    const ids = [await createGarden(page), await createGarden(page), await createGarden(page)]
    await page.addInitScript(([a, b, c]) => {
      window.localStorage.setItem(
        'bloomnote:mine',
        JSON.stringify([
          {
            id: a,
            to: 'Nadia',
            from: 'Aiden',
            createdAt: '2026-08-20T10:00:00.000Z',
            occasion: 'thank-you',
            swatches: ['#6f8fd0'],
          },
          {
            id: b,
            to: 'Theo',
            from: 'Aiden',
            createdAt: '2026-08-25T10:00:00.000Z',
            occasion: 'birthday',
            swatches: ['#d1477a'],
          },
          {
            id: c,
            to: 'Roberta',
            from: 'Aiden',
            createdAt: '2026-08-28T10:00:00.000Z',
            occasion: 'just-because',
            swatches: ['#e8a33d'],
          },
        ]),
      )
      window.localStorage.setItem('bloomnote:pinned-gardens', JSON.stringify([b]))
    }, ids)
    await page.goto('/mine')

    const rows = page.getByRole('listitem')
    await expect(rows).toHaveCount(3)
    // Pinned first, then newest. Theo is pinned; Roberta is the newest of the rest.
    await expect(rows.nth(0)).toContainText('Theo')
    await expect(rows.nth(1)).toContainText('Roberta')

    const search = page.getByRole('searchbox')
    await search.fill('Roberta')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Roberta')
    await search.fill('')
    await expect(rows).toHaveCount(3)

    await page.getByLabel('Sort gardens').selectOption('oldest')
    // Pinning outranks the sort, so Theo stays on top and the rest reverse behind him.
    await expect(rows.nth(0)).toContainText('Theo')
    await expect(rows.nth(1)).toContainText('Nadia')

    const pinnedFilter = page.getByRole('button', { name: /pinned \(1\)/i })
    await pinnedFilter.click()
    await expect(pinnedFilter).toHaveAttribute('aria-pressed', 'true')
    await expect(rows).toHaveCount(1)
    await pinnedFilter.click()
    await expect(rows).toHaveCount(3)
  })

  test('offers exactly one way out of an empty archive', async ({ page }) => {
    // Two links to the same page read as a mistake, so the empty state carries its own.
    await page.goto('/mine')
    await expect(page.getByRole('heading', { level: 1, name: /your gardens/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /grow one/i })).toHaveCount(1)
  })
})

test('a scheduled garden counts down instead of opening', async ({ page }) => {
  await page.goto('/')
  const id = await createGarden(page, { unlockAt: '2099-06-01T12:00:00.000Z' })
  await page.goto(`/g/${id}`)

  await expect(page.getByRole('heading', { level: 1, name: /grew Nadia a garden/i })).toBeVisible()
  await expect(page.getByText(/opens in/i)).toBeVisible()
  // The flowers must not be reachable before the moment the sender picked.
  await expect(page.getByRole('button', { name: /open the garden/i })).toHaveCount(0)
  await expect(page.getByText(NOTE)).toHaveCount(0)
})

test('the legal pages render as real documents', async ({ page }) => {
  for (const [path, title] of [
    ['/privacy', /privacy/i],
    ['/terms', /terms/i],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /bloomnote/i }).first()).toBeVisible()
  }
})
