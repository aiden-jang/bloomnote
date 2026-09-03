// Types the bindings `cloudflare:test` hands the tests. bloomnote injects nothing beyond the
// Worker's own Env, so this only widens ProvidedEnv to it.
import type { Env as WorkerEnv } from '../src/env'

declare module 'cloudflare:test' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ProvidedEnv extends WorkerEnv {}
}
