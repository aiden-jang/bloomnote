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
