/*
 * A pure function of the pathname, not a reader of window.location, so the routing table is
 * checkable without a browser.
 *
 *   /g/<id>  recipient view, KV lookup
 *   /r/<id>  composer in remix mode, KV lookup for the seed
 *   /mine    on-device archive, client only
 *   /        composer
 */
import { isShortId } from '../garden'

export interface ParsedRoute {
  view: 'composer' | 'recipient' | 'mine' | 'privacy' | 'terms'
  short?: string
  malformed?: boolean
}

export function parseRoute(pathname: string): ParsedRoute {
  if (pathname === '/mine' || pathname === '/mine/') return { view: 'mine' }
  if (pathname === '/privacy' || pathname === '/privacy/') return { view: 'privacy' }
  if (pathname === '/terms' || pathname === '/terms/') return { view: 'terms' }

  const shared = pathname.match(/^\/g\/(.+)$/)
  if (shared) {
    const seg = shared[1]!
    return isShortId(seg) ? { view: 'recipient', short: seg } : { view: 'recipient', malformed: true }
  }

  const remix = pathname.match(/^\/r\/(.+)$/)
  if (remix) {
    const seg = remix[1]!
    // A malformed remix segment isn't fatal. Drop the seed and show a fresh composer rather than
    // 404ing on a mistyped URL. A malformed /g/ id is a dead end, because there is no garden.
    return isShortId(seg) ? { view: 'composer', short: seg } : { view: 'composer' }
  }

  return { view: 'composer' }
}
