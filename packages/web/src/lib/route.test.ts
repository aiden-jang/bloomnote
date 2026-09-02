import { describe, expect, it } from 'vitest'
import { parseRoute } from './route'

describe('parseRoute', () => {
  it('sends the bare path and anything unrecognised to the composer', () => {
    expect(parseRoute('/')).toEqual({ view: 'composer' })
    expect(parseRoute('/nothing/here')).toEqual({ view: 'composer' })
  })

  it('tolerates a trailing slash on the static routes', () => {
    for (const view of ['mine', 'privacy', 'terms'] as const) {
      expect(parseRoute(`/${view}`)).toEqual({ view })
      expect(parseRoute(`/${view}/`)).toEqual({ view })
    }
  })

  it('resolves a share link to the recipient view with its id', () => {
    expect(parseRoute('/g/kWzDsL')).toEqual({ view: 'recipient', short: 'kWzDsL' })
  })

  it('resolves a reply link to the composer with the seed id', () => {
    expect(parseRoute('/r/kWzDsL')).toEqual({ view: 'composer', short: 'kWzDsL' })
  })

  /*
   * The two malformed cases are deliberately different, and the difference is the product.
   *
   * A broken /g/ link has no garden to show, so it must reach the 404 that says gardens never
   * expire. A broken /r/ link is somebody about to write their own note, so dropping the seed and
   * showing them an empty composer is kinder than a dead end.
   */
  it('treats a malformed share id as a dead end but a malformed reply id as a fresh start', () => {
    expect(parseRoute('/g/not-a-real-id!')).toEqual({ view: 'recipient', malformed: true })
    expect(parseRoute('/r/not-a-real-id!')).toEqual({ view: 'composer' })
  })

  it('does not mistake a longer path under /g/ for an id', () => {
    // `.+` matches slashes, so this arrives as the segment "kWzDsL/extra" and must not pass.
    expect(parseRoute('/g/kWzDsL/extra')).toEqual({ view: 'recipient', malformed: true })
  })

  /*
   * The alphabet drops 0/O and 1/l/I because people mistype them reading a link aloud. An id
   * containing one of those is not a near miss, it is not an id.
   */
  it('rejects an id using a character the alphabet deliberately excludes', () => {
    expect(parseRoute('/g/abc123')).toEqual({ view: 'recipient', malformed: true })
    expect(parseRoute('/g/abcIOl')).toEqual({ view: 'recipient', malformed: true })
  })
})
