import type { Env } from './env.js'
import { safeMeta } from './eventMeta.js'

/*
 * Every app writes to one dataset, so the column meanings have to be the same everywhere:
 *
 *   index1/blob1 app   blob2 event   blob3 variant   blob4 detail   blob5 outcome
 *   double1 count (always 1)   double2 durationMs   double3 magnitude
 *
 * `variant` is the categorical dimension the event is really about (a split type, a game mode);
 * `detail` is the secondary one. Anything not in eventMeta's allowlist never reaches here.
 */
const APP = 'bloomnote'

export function writeEvent(env: Env, name: string, rawMeta: unknown): void {
  if (!env.EVENTS) return
  const meta = safeMeta(rawMeta)
  const str = (k: string): string => (typeof meta[k] === 'string' ? (meta[k] as string) : '')
  const num = (k: string): number => (typeof meta[k] === 'number' ? (meta[k] as number) : 0)
  try {
    env.EVENTS.writeDataPoint({
      indexes: [APP],
      blobs: [
        APP,
        name,
        str('mode') || str('occasion') || str('format'),
        str('mood') || str('errorType'),
        str('surface') || str('method'),
      ],
      doubles: [1, num('durationMs'), num('flowerCount')],
    })
  } catch {
    /* Aggregate counters are best effort and must not fail product actions. */
  }
}
