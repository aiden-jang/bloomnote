// Shared browser/Worker contract. Dynamic path segments never enter an event.
export const APP = 'bloomnote'
export const HOST = 'bloomnote.aidenjang.com'
export const PAGES = ['composer', 'garden', 'mine', 'other', 'privacy', 'terms'] as const
export const ACTIONS = [] as const
export type Page = (typeof PAGES)[number]
export type AnalyticsEvent = { name: 'page_view'; page: Page } | { name: (typeof ACTIONS)[number] }
const exact: Record<string, Page> = {
  '/': 'composer',
  '/mine': 'mine',
  '/privacy': 'privacy',
  '/terms': 'terms',
}
const prefixes: readonly (readonly [string, Page])[] = [
  ['/g/', 'garden'],
  ['/r/', 'garden'],
]
export function pageForPath(pathname: string): Page {
  const path = pathname.split(/[?#]/)[0] ?? ''
  if (Object.prototype.hasOwnProperty.call(exact, path)) return exact[path]!
  return prefixes.find(([prefix]) => path.startsWith(prefix))?.[1] ?? 'other'
}
export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const event = value as Record<string, unknown>
  const keys = Object.keys(event)
  if (event.name === 'page_view')
    return (
      keys.length === 2 &&
      keys.includes('page') &&
      typeof event.page === 'string' &&
      (PAGES as readonly string[]).includes(event.page)
    )
  return (
    keys.length === 1 && typeof event.name === 'string' && (ACTIONS as readonly string[]).includes(event.name)
  )
}

export const PRODUCT_EVENTS = [
  'composer_opened',
  'garden_generated',
  'garden_error',
  'garden_canceled',
  'garden_rerolled',
  'share_link_copied',
  'share_link_shared',
  'card_downloaded',
  'make_another',
  'garden_opened',
  'garden_bloomed',
  'garden_reshared',
  'reply_started',
] as const

// Confirmed server operations cannot be fabricated through the anonymous browser endpoint.
export const BROWSER_ACTIONS: readonly string[] = ACTIONS
export function isBrowserAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!isAnalyticsEvent(value)) return false
  const name = value.name
  return name === 'page_view' || BROWSER_ACTIONS.includes(name)
}
