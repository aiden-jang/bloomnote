import { DurableObject } from 'cloudflare:workers'

export interface WindowResult {
  ok: boolean
  retryAfter: number
}

interface CountWindow {
  start: number
  count: number
}

/** Atomic fixed-window counter. Don't move these counts back to KV: its read-modify-write is
    not atomic, and 40 parallel requests all read the same count and all passed a limit of 5. */
export class Counters extends DurableObject {
  async bump(bucket: string, limit: number, windowSeconds: number): Promise<WindowResult> {
    const windowMs = windowSeconds * 1000
    let result: WindowResult = { ok: true, retryAfter: 0 }
    // Redundant while both awaits below are storage calls, which input gating already
    // serializes. It still holds if a non-storage await ever lands in here, when gating would not.
    await this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now()
      const start = Math.floor(now / windowMs) * windowMs
      const stored = await this.ctx.storage.get<CountWindow>(bucket)
      const count = (stored?.start === start ? stored.count : 0) + 1
      await this.ctx.storage.put(bucket, { start, count })
      result =
        count <= limit
          ? { ok: true, retryAfter: 0 }
          : { ok: false, retryAfter: Math.ceil((start + windowMs - now) / 1000) }
    })
    return result
  }
}
