/** Read at call time rather than cached, so a visitor who changes the OS setting mid-session
    gets the new answer. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
