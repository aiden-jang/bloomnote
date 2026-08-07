# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey.spec.ts >> compose → bloom → share → recipient >> a garden can be grown, shared, and opened
- Location: e2e/journey.spec.ts:77:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /open the garden/i })
    - locator resolved to <button type="button" class="_openBtn_1886u_143">open the garden</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not stable
    - retrying click action
      - waiting 100ms
    113 × waiting for element to be visible, enabled and stable
        - element is not stable
      - retrying click action
        - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=f1e2]:
  - button "sign in" [ref=f1e4] [cursor=pointer]
  - generic [ref=f1e5]:
    - button "mute sound" [pressed] [ref=f1e6] [cursor=pointer]
    - paragraph [ref=f1e11]: Aiden grew Nadia a garden
    - generic [ref=f1e14]:
      - generic "Hydrangea" [ref=f1e15]
      - generic "Dahlia" [ref=f1e17]
      - generic "Sunflower" [ref=f1e19]
    - button "open the garden" [ref=f1e24] [cursor=pointer]
  - contentinfo [ref=f1e25]:
    - link "made by aiden jang" [ref=f1e26] [cursor=pointer]:
      - /url: https://www.aidenjang.com
    - text: ·
    - link "privacy" [ref=f1e27] [cursor=pointer]:
      - /url: http://localhost:34100/privacy
    - text: ·
    - link "terms" [ref=f1e28] [cursor=pointer]:
      - /url: http://localhost:34100/terms
```

# Test source

```ts
  23  |       stemColor: '#5f8a52',
  24  |       petalShape: 'round',
  25  |       petalCount: 9,
  26  |       stemHeight: 96,
  27  |     },
  28  |     {
  29  |       name: 'Dahlia',
  30  |       meaning: 'For never once making it a big deal.',
  31  |       petalColors: ['#d1477a', '#e06b96', '#ef9ab8'],
  32  |       centerColor: '#f7e3a1',
  33  |       stemColor: '#5f8a52',
  34  |       petalShape: 'star',
  35  |       petalCount: 12,
  36  |       stemHeight: 104,
  37  |     },
  38  |     {
  39  |       name: 'Sunflower',
  40  |       meaning: 'For the hospital car park, of all places.',
  41  |       petalColors: ['#e8a33d', '#f0b95c', '#f6d089'],
  42  |       centerColor: '#6b4423',
  43  |       stemColor: '#5f8a52',
  44  |       petalShape: 'elongated',
  45  |       petalCount: 14,
  46  |       stemHeight: 112,
  47  |     },
  48  |   ],
  49  | };
  50  | 
  51  | const NOTE =
  52  |   'you drove four hours in the rain to sit in a hospital car park with me and did not once make it a big deal.';
  53  | 
  54  | /**
  55  |  * Intercept the one paid call. Returns the whole SSE body at once, which the client reads to EOF
  56  |  * exactly as it reads the real stream.
  57  |  */
  58  | async function stubDesign(page: Page): Promise<void> {
  59  |   await page.route('**/api/design-garden', async (route) => {
  60  |     const frames = [
  61  |       `event: start\ndata: ${JSON.stringify({ ok: true })}\n\n`,
  62  |       `event: thinking\ndata: {}\n\n`,
  63  |       `event: complete\ndata: ${JSON.stringify({ garden: GARDEN })}\n\n`,
  64  |     ].join('');
  65  |     await route.fulfill({
  66  |       status: 200,
  67  |       headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' },
  68  |       body: frames,
  69  |     });
  70  |   });
  71  | }
  72  | 
  73  | /** Petals are <path> inside the scene; a bloomed garden has many, an empty plot has none. */
  74  | const petals = (page: Page) => page.locator('svg path');
  75  | 
  76  | test.describe('compose → bloom → share → recipient', () => {
  77  |   test('a garden can be grown, shared, and opened', async ({ page }) => {
  78  |     await stubDesign(page);
  79  |     await page.goto('/');
  80  | 
  81  |     // --- Arrive -----------------------------------------------------------------------------
  82  |     // The homepage hero grows a real demo garden rather than showing an empty plot. If that
  83  |     // regresses, a first-time visitor's first impression is a blank rectangle again.
  84  |     await expect(page.getByRole('heading', { name: 'bloomnote' })).toBeVisible();
  85  |     await expect(petals(page).first()).toBeVisible();
  86  | 
  87  |     // --- Write ------------------------------------------------------------------------------
  88  |     await page.getByPlaceholder('your name').fill('Aiden');
  89  |     await page.getByPlaceholder('their name').fill('Nadia');
  90  |     await page.locator('textarea').fill(NOTE);
  91  | 
  92  |     // Starting a draft clears the demo and shrinks the plot to a waiting bed, so the note field
  93  |     // is not pushed below the fold by 260px of empty sky.
  94  |     const scene = page.locator('[class*="scene"]').first();
  95  |     await expect(scene).toHaveJSProperty('offsetHeight', 132);
  96  | 
  97  |     // --- Bloom ------------------------------------------------------------------------------
  98  |     await page.getByRole('button', { name: /grow .* garden/i }).click();
  99  | 
  100 |     await expect(page.getByText(NOTE)).toBeVisible();
  101 |     await expect(page.getByText('for the drive, and for not making it a thing.').first()).toBeVisible();
  102 | 
  103 |     // Every flower, with its meaning, and no flower repeating its own name into the meaning.
  104 |     for (const f of GARDEN.flowers) {
  105 |       await expect(page.getByText(f.name, { exact: true }).first()).toBeVisible();
  106 |       await expect(page.getByText(f.meaning).first()).toBeVisible();
  107 |     }
  108 | 
  109 |     // --- Share ------------------------------------------------------------------------------
  110 |     // The share link is written to real KV by the real endpoint; only the AI call was faked.
  111 |     const link = page.getByText(/\/g\/[A-Za-z0-9]{6}/).first();
  112 |     await expect(link).toBeVisible();
  113 |     const shareUrl = (await link.textContent())!.trim();
  114 |     expect(shareUrl).toMatch(/\/g\/[A-Za-z0-9]{6}$/);
  115 | 
  116 |     // --- Receive ----------------------------------------------------------------------------
  117 |     // A fresh context would be more faithful, but same-page navigation still exercises the part
  118 |     // that matters: the recipient route resolving a stored garden from its id alone.
  119 |     await page.goto(new URL(shareUrl).pathname);
  120 | 
  121 |     // Not getByText('Aiden'): the footer credit "made by aiden jang" also matches it.
  122 |     await expect(page.getByText(/grew Nadia a garden/i)).toBeVisible();
> 123 |     await page.getByRole('button', { name: /open the garden/i }).click();
      |                                                                  ^ Error: locator.click: Test timeout of 60000ms exceeded.
  124 | 
  125 |     await expect(page.getByText(NOTE)).toBeVisible();
  126 |     await expect(petals(page).first()).toBeVisible();
  127 |     for (const f of GARDEN.flowers) {
  128 |       await expect(page.getByText(f.meaning).first()).toBeVisible();
  129 |     }
  130 |     // The reply loop is the thing that makes this a conversation rather than a one-way card.
  131 |     await expect(page.getByRole('link', { name: /grow Aiden a garden/i })).toBeVisible();
  132 |   });
  133 | 
  134 |   test('a dead link says the garden is still there', async ({ page }) => {
  135 |     // Recipients arrive by pasted link, so a truncated one is a normal event, not an edge case.
  136 |     // Gardens have no TTL, so this page must never claim the gift expired.
  137 |     await page.goto('/g/zzzz99');
  138 |     // `.` for the apostrophe: the copy uses a typographic one (&rsquo;), not U+0027.
  139 |     await expect(page.getByText(/didn.t lead anywhere/i)).toBeVisible();
  140 |     await expect(page.getByText(/gardens never expire/i)).toBeVisible();
  141 |     // The assertion that matters, stated as the rule rather than as a count: this page must
  142 |     // never tell someone the gift they were sent is gone, because it isn't.
  143 |     await expect(page.locator('body')).not.toContainText(/(link|garden).{0,20}expired/i);
  144 |   });
  145 | });
  146 | 
```