import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup as render } from 'react-dom/server'
import ShareCard from '../components/ShareCard'
import FlowerPeek from '../components/FlowerPeek'
import { AuthProvider } from '../auth/AuthContext'
import type { GardenData } from '../garden'

const garden: GardenData = {
  from: 'Alex & Bea',
  to: 'Sam <3',
  message: 'These are my exact words.',
  secret: 'Our private aside.',
  bouquetNote: '',
  flowers: [
    {
      artVersion: 3,
      name: 'Cosmos',
      meaning: 'For the little things.',
      petalColors: ['#b8a0cf', '#cebddf', '#e2d5ec'],
      centerColor: '#d9ac50',
      stemColor: '#78905b',
      petalShape: 'round',
      petalCount: 8,
      stemHeight: 95,
    },
  ],
}
const props = {
  garden,
  gardenId: 'AbCdEf',
  shareUrl: 'https://example.test/g/AbCdEf',
  copied: false,
  shareStatus: null,
  imageStatus: null,
  canShare: false,
  shareError: null,
  isRerolling: false,
  errorText: null,
  statusText: '',
  onShare() {},
  onCopy() {},
  onSaveImage() {},
  onReroll() {},
  onStartOver() {},
}
const card = (overrides: Partial<Parameters<typeof ShareCard>[0]> = {}) =>
  render(
    <AuthProvider>
      <ShareCard {...props} {...overrides} />
    </AuthProvider>,
  )

describe('ready-to-give presentation', () => {
  it('addresses the gift without revealing the note or secret before opening', () => {
    const html = card()
    expect(html).toContain('for Sam &lt;3')
    expect(html).toContain('from Alex &amp; Bea')
    expect(html).toContain('aria-label="preview the opening"')
    expect(html).toContain('Share the link with')
    expect(html).not.toContain(garden.message)
    expect(html).not.toContain(garden.secret)
    expect(html).toContain('data-recipient-preview="true"')
    expect(html).not.toContain('data-letter-page="recipient"')
  })

  it('offers the available sharing action and retains a manually selectable link after failure', () => {
    const fallback = card({ shareError: 'Couldn’t copy the link.' })
    expect(fallback).toContain('role="alert"')
    expect(fallback).toContain('readonly=""')
    expect(fallback).toContain(`value="${props.shareUrl}"`)
    expect(fallback).toContain('copy link')
    expect(fallback).not.toContain('>share garden<')
    expect(card({ canShare: true })).toContain('>share garden<')
  })

  it('distinguishes a scheduled recipient link from the sender’s available preview', () => {
    const html = card({ garden: { ...garden, unlockAt: '2030-06-10T12:00:00Z' } })
    expect(html).toContain('opens later')
    expect(html).toContain('Their link opens')
    expect(html).toContain('2030')
    expect(html).toContain('You can preview the opening now.')
    expect(html).toContain(`href="${props.shareUrl}"`)
  })

  it('keeps the previous link and error visible while replacement flowers are unavailable', () => {
    const html = card({ isRerolling: true, statusText: 'choosing different flowers…' })
    expect(html).toContain('role="status"')
    expect(html).toContain('choosing different flowers…')
    expect(html).not.toContain('data-recipient-preview')
    expect(card({ errorText: 'Your previous garden is still available.' })).toContain(
      `value="${props.shareUrl}"`,
    )
  })

  it('makes a preview flower informational even when an identifier is supplied', () => {
    const html = render(
      <FlowerPeek
        flower={garden.flowers[0]!}
        index={0}
        journalGardenId="AbCdEf"
        readOnly
        onClose={() => {}}
      />,
    )
    expect(html).toContain('For the little things.')
    expect(html).toContain('Close flower meaning')
    expect(html).not.toContain('keep in my flower journal')
    expect(html).not.toContain('share this flower')
    expect(html).not.toContain('save a pressed-flower card')
  })
})
