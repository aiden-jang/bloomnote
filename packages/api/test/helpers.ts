import { env } from 'cloudflare:test';
import type { Env } from '../src/env.js';

// The test worker's bindings (a real in-memory KV for GARDENS), typed as the app's Env.
export const testEnv = env as unknown as Env;
