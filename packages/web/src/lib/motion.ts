/**
 * Whether the visitor has asked their OS for less motion.
 *
 * Read at call time rather than cached, because the setting can change while the tab is open.
 *
 * This exists as its own module because the check kept getting re-declared per component (it was
 * three identical copies before), and a fourth copy is exactly where the one that forgets the
 * `typeof window` guard or the optional-chained `matchMedia` would have shown up.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}
