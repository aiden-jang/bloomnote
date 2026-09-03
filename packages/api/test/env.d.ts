// Types the bindings the test runtime hands the tests. bloomnote injects nothing beyond the
// Worker's own Env, so this only widens Cloudflare.Env to it.
import type { Env as WorkerEnv } from '../src/env'

declare global {
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Env extends WorkerEnv {}
  }
}
