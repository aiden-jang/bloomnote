/*
 * Small because there is no pressure to switch off: no streaks anywhere, nothing counts days. All this
 * hides is the useful tallies, which are still numbers on a bad day. Default is chosen for the bad day.
 */

const STORAGE_KEY = 'bloomnote.quiet.v1'
export const QUIET_MODE_EVENT = 'bloomnote:quiet-mode'

/**
 * Quiet by default.
 *
 * The opposite of the usual default, and deliberate: the person who most needs the counts gone is the
 * least likely to go looking for a setting. Anybody who wants the numbers can ask for them, and wanting
 * them is a good day's decision.
 */
export function isQuiet(): boolean {
  try {
    // Only an explicit opt-out turns the numbers on, so a cleared or unavailable store stays quiet.
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

/**
 * Returns the new state so a caller can update its own UI without a second read.
 *
 * Both halves are guarded, and unqualified globals are used rather than `window.` so the two functions
 * agree about what "no browser" means. They did not: isQuiet checked for a missing window and setQuiet
 * assumed one, so the reader degraded politely and the writer threw.
 */
export function setQuiet(quiet: boolean): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, quiet ? 'on' : 'off')
  } catch {
    // Private mode: the preference will not survive a reload, and the default it falls back to is quiet.
  }
  try {
    dispatchEvent(new Event(QUIET_MODE_EVENT))
  } catch {
    // No event target to tell. The caller already has the return value it needs.
  }
  return quiet
}

export function toggleQuiet(): boolean {
  return setQuiet(!isQuiet())
}
