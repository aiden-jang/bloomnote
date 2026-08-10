import { expect, test, type Page } from '@playwright/test';

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

/** A garden shaped exactly like the Worker's `complete` payload (snake_case bouquet_note). */
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
};

const NOTE =
  'you drove four hours in the rain to sit in a hospital car park with me and did not once make it a big deal.';

/**
 * Intercept the one paid call. Returns the whole SSE body at once, which the client reads to EOF
 * exactly as it reads the real stream.
 */
async function stubDesign(page: Page): Promise<void> {
  await page.route('**/api/design-garden', async (route) => {
    const frames = [
      `event: start\ndata: ${JSON.stringify({ ok: true })}\n\n`,
      `event: thinking\ndata: {}\n\n`,
      `event: complete\ndata: ${JSON.stringify({ garden: GARDEN })}\n\n`,
    ].join('');
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
      body: frames,
    });
  });
}

/** Petals are <path> inside the scene; a bloomed garden has many, an empty plot has none. */
const petals = (page: Page) => page.locator('svg path');

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
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test.describe('compose → bloom → share → recipient', () => {
  test('a note in progress survives a refresh in the same tab', async ({ page }) => {
    await page.goto('/')

    await page.getByPlaceholder('your name').fill('Aiden')
    await page.getByPlaceholder('their name').fill('Nadia')
    await page.locator('textarea').fill('I kept thinking about that rainy drive home.')

    // Wait for the tab-local recovery cache rather than assuming React has
    // flushed its effect before the reload starts.
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('bloomnote:draft:/'))).not.toBeNull()
    await page.reload()

    await expect(page.getByPlaceholder('your name')).toHaveValue('Aiden')
    await expect(page.getByPlaceholder('their name')).toHaveValue('Nadia')
    await expect(page.locator('textarea')).toHaveValue('I kept thinking about that rainy drive home.')
    await expect(page.getByRole('status')).toContainText('Your draft is still here.')

    // Clear means clear: a deliberate reset must win over recovery.
    await page.getByRole('button', { name: 'clear draft' }).click()
    await page.reload()
    await expect(page.getByPlaceholder('your name')).toHaveValue('')
    await expect(page.getByPlaceholder('their name')).toHaveValue('')
    await expect(page.locator('textarea')).toHaveValue('')
  })

  test('a garden can be grown, shared, and opened', async ({ page }) => {
    await stubDesign(page);
    await page.goto('/');

    // --- Arrive -----------------------------------------------------------------------------
    // The homepage hero grows a real demo garden rather than showing an empty plot. If that
    // regresses, a first-time visitor's first impression is a blank rectangle again.
    await expect(page.getByRole('heading', { name: 'bloomnote' })).toBeVisible();
    await expect(petals(page).first()).toBeVisible();

    // --- Write ------------------------------------------------------------------------------
    await page.getByPlaceholder('your name').fill('Aiden');
    await page.getByPlaceholder('their name').fill('Nadia');
    await page.locator('textarea').fill(NOTE);

    // Starting a draft clears the demo and shrinks the plot to a waiting bed, so the note field
    // is not pushed below the fold by 260px of empty sky.
    const scene = page.locator('[class*="scene"]').first();
    await expect(scene).toHaveJSProperty('offsetHeight', 132);

    // --- Bloom ------------------------------------------------------------------------------
    await page.getByRole('button', { name: /grow .* garden/i }).click();

    await expect(page.getByText(NOTE)).toBeVisible();
    await expect(page.getByText('for the drive, and for not making it a thing.').first()).toBeVisible();

    // Every flower, with its meaning, and no flower repeating its own name into the meaning.
    for (const f of GARDEN.flowers) {
      await expect(page.getByText(f.name, { exact: true }).first()).toBeVisible();
      await expect(page.getByText(f.meaning).first()).toBeVisible();
    }

    // --- Share ------------------------------------------------------------------------------
    // The share link is written to real KV by the real endpoint; only the AI call was faked.
    const link = page.getByText(/\/g\/[A-Za-z0-9]{6}/).first();
    await expect(link).toBeVisible();
    const shareUrl = (await link.textContent())!.trim();
    expect(shareUrl).toMatch(/\/g\/[A-Za-z0-9]{6}$/);

    // --- Receive ----------------------------------------------------------------------------
    // A fresh context would be more faithful, but same-page navigation still exercises the part
    // that matters: the recipient route resolving a stored garden from its id alone.
    await page.goto(new URL(shareUrl).pathname);

    // Not getByText('Aiden'): the footer credit "made by aiden jang" also matches it.
    await expect(page.getByText(/grew Nadia a garden/i)).toBeVisible();
    await page.getByRole('button', { name: /open the garden/i }).click();

    await expect(page.getByText(NOTE)).toBeVisible();
    await expect(petals(page).first()).toBeVisible();
    for (const f of GARDEN.flowers) {
      await expect(page.getByText(f.meaning).first()).toBeVisible();
    }
    // The reply loop is the thing that makes this a conversation rather than a one-way card.
    await expect(page.getByRole('link', { name: /grow Aiden a garden/i })).toBeVisible();
  });

  test('a dead link says the garden is still there', async ({ page }) => {
    // Recipients arrive by pasted link, so a truncated one is a normal event, not an edge case.
    // Gardens have no TTL, so this page must never claim the gift expired.
    await page.goto('/g/zzzz99');
    // `.` for the apostrophe: the copy uses a typographic one (&rsquo;), not U+0027.
    await expect(page.getByText(/didn.t lead anywhere/i)).toBeVisible();
    await expect(page.getByText(/gardens never expire/i)).toBeVisible();
    // The assertion that matters, stated as the rule rather than as a count: this page must
    // never tell someone the gift they were sent is gone, because it isn't.
    await expect(page.locator('body')).not.toContainText(/(link|garden).{0,20}expired/i);
  });
});
