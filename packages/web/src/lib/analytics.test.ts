import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as analytics from './analytics'
import { HOST, PRODUCT_EVENTS } from '../../../../analytics/schema.js'

beforeEach(() => {
  vi.stubGlobal('window', { location: { hostname: HOST } })
  vi.stubGlobal('navigator', {})
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
})
afterEach(() => vi.unstubAllGlobals())
const bodies = () => vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init!.body)))

describe('garden analytics', () => {
  it('sends a fixed event without cookies or a garden URL in the Referer', () => {
    analytics.trackComposerOpened('remix')
    expect(fetch).toHaveBeenCalledWith(
      '/api/event',
      expect.objectContaining({
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        keepalive: true,
        body: JSON.stringify({ name: 'composer_opened', meta: { mode: 'remix' } }),
      }),
    )
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('tracks every exported garden action using an event the server accepts', () => {
    analytics.trackComposerOpened('fresh')
    analytics.trackGardenGenerated({
      occasion: 'thank-you',
      mood: 'tender',
      flowerCount: 3,
      hasFromName: true,
      isRemix: false,
      durationMs: 4200,
    })
    analytics.trackGardenError('network')
    analytics.trackGardenCanceled()
    analytics.trackShareLinkCopied()
    analytics.trackShareLinkShared()
    analytics.trackCardDownloaded('recipient', 'duet')
    analytics.trackMakeAnother()
    analytics.trackGardenRerolled({ attempt: 1, durationMs: 400 })
    analytics.trackGardenOpened({ flowerCount: 3, hasFromName: true, hasThread: false })
    analytics.trackGardenBloomed()
    analytics.trackGardenReshared('copy')
    analytics.trackReplyStarted()
    expect(
      bodies()
        .map((e) => e.name)
        .sort(),
    ).toEqual([...PRODUCT_EVENTS].sort())
    expect(bodies().find((e) => e.name === 'garden_generated').meta.occasion).toBe('thank-you')
  })
  it('drops private text even if accidentally passed in a permitted string field', () => {
    analytics.trackGardenError('PRIVATE NOTE')
    analytics.trackGardenGenerated({
      occasion: 'PRIVATE NAME',
      mood: 'PRIVATE NOTE',
      flowerCount: 3,
      hasFromName: true,
      isRemix: false,
      durationMs: 900,
    })
    expect(JSON.stringify(bodies())).not.toContain('PRIVATE')
    expect(bodies()[0].meta).toEqual({})
  })
  it('honors privacy choices and excludes development/preview hosts', () => {
    vi.stubGlobal('navigator', { globalPrivacyControl: true })
    analytics.trackComposerOpened('fresh')
    vi.stubGlobal('navigator', { doNotTrack: '1' })
    analytics.trackComposerOpened('fresh')
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('window', { location: { hostname: 'localhost' } })
    analytics.trackComposerOpened('fresh')
    expect(fetch).not.toHaveBeenCalled()
  })
  it('a blocked or offline request never fails the user action', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(() => analytics.trackComposerOpened('fresh')).not.toThrow()
    await Promise.resolve()
    vi.stubGlobal('fetch', () => {
      throw new Error('blocked')
    })
    expect(() => analytics.trackComposerOpened('fresh')).not.toThrow()
  })
})
