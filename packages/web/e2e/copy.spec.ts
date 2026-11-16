import { expect, test } from '@playwright/test'

for (const occasion of ['sympathy', 'get well', 'birthday']) {
  test(`${occasion} keeps its supporting copy when a playful note starts growing`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    // Keep generation pending: the aside must be checked during the actual designing phase.
    await page.route('**/api/design-garden', () => {})
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'A note. With flowers.' })).toBeVisible()
    await page.getByText('occasion & mood', { exact: true }).click()
    await page
      .getByRole('radiogroup', { name: 'occasion', exact: true })
      .getByRole('radio', { name: occasion, exact: true })
      .click()
    await page
      .getByRole('radiogroup', { name: 'mood', exact: true })
      .getByRole('radio', { name: 'playful', exact: true })
      .click()
    const ordinary = occasion === 'birthday'
    await expect(
      page.getByText(ordinary ? 'No vase required.' : 'A garden for your note.', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByText(ordinary ? 'One specific detail goes a long way.' : 'A short note is enough.', {
        exact: true,
      }),
    ).toBeVisible()
    await page.getByLabel('your note', { exact: true }).fill('my words, exactly as i wrote them.')
    await page.getByPlaceholder('their name').fill('Sam')
    await page.getByText('add a secret', { exact: true }).click()
    const secret = page.getByLabel('a little aside they can tap to reveal', { exact: true })
    await expect(secret).toHaveAttribute(
      'placeholder',
      ordinary ? 'p.s. there was one more thing.' : 'One more thing you’d like them to know.',
    )
    await secret.fill('and this stays mine too.')
    await page.getByRole('button', { name: /grow .* garden/ }).click()
    await expect(
      page.getByText(ordinary ? 'A small botanical overreaction.' : 'Choosing flowers for your note.', {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByText(ordinary ? 'Choosing flowers for your note.' : 'A small botanical overreaction.', {
        exact: true,
      }),
    ).toHaveCount(0)
    await page.getByRole('button', { name: 'cancel', exact: true }).click()
    await expect(page.getByLabel('your note', { exact: true })).toHaveValue(
      'my words, exactly as i wrote them.',
    )
    await expect(secret).toHaveValue('and this stays mine too.')
  })
}
