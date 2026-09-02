import { afterEach, describe, expect, it, vi } from 'vitest'
import { trackComposerOpened, trackGardenError, trackGardenGenerated, trackGardenOpened } from './analytics'

/** Whatever reached the wire, whichever transport carried it. */
function stubTransports(opts: { beacon?: boolean | 'throw' } = {}) {
  const sent: { via: string; body: unknown }[] = []
  const sendBeacon =
    opts.beacon === 'throw'
      ? () => {
          throw new Error('beacon refused')
        }
      : (_url: string, body: string) => {
          sent.push({ via: 'beacon', body: JSON.parse(body) })
          return opts.beacon !== false
        }
  vi.stubGlobal('navigator', { sendBeacon })
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init: { body: string }) => {
      sent.push({ via: 'fetch', body: JSON.parse(init.body) })
      return Promise.resolve({ ok: true })
    }),
  )
  return sent
}

/*
 * Every string in an event's metadata has to be slug-shaped.
 *
 * Checked as a rule rather than against a list of expected values, because the failure mode is
 * somebody adding a field later. A bucket name is one token; a note is prose, and prose has spaces.
 */
function expectNoProse(sent: { body: unknown }[]): void {
  for (const { body } of sent) {
    for (const [key, value] of Object.entries((body as { meta: Record<string, unknown> }).meta)) {
      if (typeof value !== 'string') {
        expect(['number', 'boolean'], `${key} is neither a slug nor a number`).toContain(typeof value)
        continue
      }
      expect(value, `${key} must be a slug, not prose`).toMatch(/^[A-Za-z0-9_-]{1,32}$/)
    }
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('analytics', () => {
  it('sends the event name and its metadata', () => {
    const sent = stubTransports()
    trackComposerOpened('remix')
    expect(sent).toEqual([{ via: 'beacon', body: { name: 'composer_opened', meta: { mode: 'remix' } } }])
  })

  /*
   * sendBeacon first because these fire as the page goes away, and a fetch started during unload is
   * often dropped. The fallback matters for browsers that have no beacon at all.
   */
  it('falls back to fetch when the beacon is refused or throws', () => {
    const refused = stubTransports({ beacon: false })
    trackComposerOpened('fresh')
    expect(refused.map((s) => s.via)).toContain('fetch')

    const threw = stubTransports({ beacon: 'throw' })
    trackComposerOpened('fresh')
    expect(threw.map((s) => s.via)).toEqual(['fetch'])
  })

  it('does not send twice when the beacon succeeds', () => {
    const sent = stubTransports()
    trackComposerOpened('fresh')
    expect(sent).toHaveLength(1)
  })

  /*
   * The constraint that matters most. /api/event is public and its payloads land in Workers Logs,
   * so a note or a name reaching it would put a private message somewhere neither person expects.
   * Every field here is structural: a count, a flag, a bucket name.
   */
  it('never carries note text or names, only shape', () => {
    const sent = stubTransports()
    trackGardenGenerated({
      occasion: 'thank-you',
      mood: 'tender',
      flowerCount: 3,
      hasFromName: true,
      isRemix: false,
      durationMs: 4200,
    })
    trackGardenOpened({ flowerCount: 3, hasFromName: true, hasThread: false })

    expectNoProse(sent)
  })

  it('reports an error as a bucket name rather than the model output', () => {
    const sent = stubTransports()
    trackGardenError('upstream_busy')
    expect((sent[0]!.body as { meta: { errorType: string } }).meta.errorType).toBe('upstream_busy')
    expectNoProse(sent)
  })

  /* Every event, not just the ones a test happens to name, so a new field cannot slip prose in. */
  it('holds every tracked event to the slug rule', () => {
    const sent = stubTransports()
    trackComposerOpened('remix')
    trackGardenError('validation_failed')
    trackGardenGenerated({
      occasion: 'sympathy',
      mood: 'steady',
      flowerCount: 5,
      hasFromName: false,
      isRemix: true,
      durationMs: 900,
    })
    trackGardenOpened({ flowerCount: 4, hasFromName: false, hasThread: true })
    expect(sent.length).toBeGreaterThanOrEqual(4)
    expectNoProse(sent)
  })

  it('does nothing at all where there is no navigator', () => {
    vi.stubGlobal('navigator', undefined)
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    expect(() => trackComposerOpened('fresh')).not.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
