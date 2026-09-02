/*
 * A code-split import that survives a deploy.
 *
 * Vite hashes chunk names, so a deploy replaces them and the service worker purges its old cache.
 * Anyone with the page open is then holding chunk names that exist nowhere, and clicking through to
 * a lazy route shows the crash screen for what is really "please refresh". Reloading fetches the
 * current index.html and the names that match it.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const ATTEMPT_KEY = 'bloomnote:chunk-reload'
/* Long enough that a reload loop cannot form, short enough that a later, genuine failure recovers. */
const COOLDOWN_MS = 10_000

function recentlyReloaded(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(ATTEMPT_KEY))
    return Number.isFinite(at) && at > 0 && Date.now() - at < COOLDOWN_MS
  } catch {
    // Fails closed: with no way to record an attempt, reloading blind loops forever.
    return true
  }
}

function markReloaded(): void {
  try {
    window.sessionStorage.setItem(ATTEMPT_KEY, String(Date.now()))
  } catch {
    // Best-effort; the read above already fails closed.
  }
}

/** Separate from the wrapper below so the recovery is testable without React's internal payload. */
export async function loadWithReload<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (recentlyReloaded()) throw error
    markReloaded()
    window.location.reload()
    // The reload wins the race. Resolving anything here would render against a dead chunk.
    return await new Promise<never>(() => {})
  }
}

/*
 * The `any` mirrors React's own constraint on `lazy`. Narrowing it to `unknown` or `never` makes
 * this generic unassignable and costs the call sites their prop types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() => loadWithReload(load))
}
