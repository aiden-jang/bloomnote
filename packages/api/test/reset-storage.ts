import { env } from 'cloudflare:test'
import { beforeEach } from 'vitest'

/*
 * The pool used to isolate storage per test and no longer does, so without this one test's
 * gardens turn up in another's "your gardens" list. Wiping is enough: KV here is in-memory.
 */
beforeEach(async () => {
  let cursor: string | undefined
  for (;;) {
    const page = await env.GARDENS.list(cursor === undefined ? {} : { cursor })
    await Promise.all(page.keys.map((key) => env.GARDENS.delete(key.name)))
    if (page.list_complete) return
    cursor = page.cursor
  }
})
