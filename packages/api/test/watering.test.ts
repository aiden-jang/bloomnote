import { env } from 'cloudflare:test';
import { describe, expect, test } from 'vitest';
import { createGarden, readWaters, waterGarden } from '../src/gardens.js';

const GARDEN = {
  flowers: [
    {
      name: 'Rose',
      meaning: 'because',
      petalColors: ['#e11d48', '#f43f5e', '#fb7185'],
      centerColor: '#ffc53d',
      stemColor: '#7c9a6e',
      petalShape: 'round',
      petalCount: 8,
      stemHeight: 92,
    },
  ],
  message: 'hi',
  from: 'A',
  to: 'B',
};

async function newGarden(): Promise<string> {
  const r = await createGarden(env as never, GARDEN);
  if (!r.ok) throw new Error(r.message);
  return r.id;
}

describe('watering', () => {
  test('counts up and refuses a garden that does not exist', async () => {
    const id = await newGarden();
    expect(await readWaters(env as never, id)).toBe(0);
    expect(await waterGarden(env as never, id)).toEqual({ ok: true, waters: 1 });
    expect(await waterGarden(env as never, id)).toEqual({ ok: true, waters: 2 });

    const missing = await waterGarden(env as never, 'zzzzzz');
    expect(missing.ok).toBe(false);
  });

  /**
   * The cap has to stop the WRITE, not just the number.
   *
   * Math.min clamped the value but still put() it every request, so a loop against one garden was an
   * unbounded stream of KV writes — the scarce quota, shared with garden creation. This counts the
   * puts directly, because a test that only asserted `waters === 99` passed the whole time the bug
   * was there.
   */
  test('stops writing once it is capped', async () => {
    const id = await newGarden();
    await env.GARDENS.put(`water:${id}`, '99');

    const puts: string[] = [];
    const realPut = env.GARDENS.put.bind(env.GARDENS);
    (env.GARDENS as unknown as { put: unknown }).put = (key: string, value: string) => {
      puts.push(key);
      return realPut(key, value);
    };
    try {
      for (let i = 0; i < 5; i++) {
        expect(await waterGarden(env as never, id)).toEqual({ ok: true, waters: 99 });
      }
    } finally {
      (env.GARDENS as unknown as { put: unknown }).put = realPut;
    }
    expect(puts).toEqual([]);
    expect(await readWaters(env as never, id)).toBe(99);
  });
});
